// Lowstate on the little desk screen.
//
// The screen is one more computer in Lowstate's Google Drive sync: every
// minute it reads the computers' files, works out today (planner.cpp) and
// draws it (ui.cpp). Tapping a task ticks it at once on screen; then the
// screen reads the latest data, ticks it there too and writes its own file,
// which the computers take in on their next sync, like a change made on
// another computer.
//
// Drawing runs in loop() (LVGL isn't thread-safe); Drive runs in its own
// task so the screen stays smooth while it talks to Google.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <XPT2046_Touchscreen.h>
#include <lvgl.h>
#include <time.h>

#include "apps.h"
#include "ota.h"
#include "byteco.h"
#include "apartment.h"
#include "drive.h"
#include "planner.h"
#include "secrets.h"
#include "weather.h"
#include "home.h"
#include "lowstate_ui.h"

// ---------- hardware ----------
#define TOUCH_CS 33
#define TOUCH_IRQ 36
#define TOUCH_MOSI 32
#define TOUCH_MISO 39
#define TOUCH_CLK 25

static const int W = 320;
static const int H = 240;

TFT_eSPI tft;
SPIClass touchSpi(VSPI);
XPT2046_Touchscreen touch(TOUCH_CS, TOUCH_IRQ);

static lv_disp_draw_buf_t drawBuffer;
static const int LINES = 40;  // bigger pieces: fewer passes over every widget
static lv_color_t* pixels = nullptr;  // W x LINES, allocated in setup()

static bool capturing = false;  // a screenshot is being sent (see screenshot())

static void flush(lv_disp_drv_t* driver, const lv_area_t* area, lv_color_t* colors) {
  const uint32_t w = area->x2 - area->x1 + 1;
  const uint32_t h = area->y2 - area->y1 + 1;
  if (capturing) {
    // Each piece as LVGL drew it: "AREA x1 y1 x2 y2" then RGB565 pixels.
    Serial.printf("AREA %d %d %d %d\n", area->x1, area->y1, area->x2, area->y2);
    Serial.write(reinterpret_cast<const uint8_t*>(colors), w * h * sizeof(lv_color_t));
  }
  // Sent right away. (Two buffers sent in the background saved ~10 ms per
  // screen but left too little memory for the TLS connections to Google.)
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors(reinterpret_cast<uint16_t*>(&colors->full), w * h, true);
  tft.endWrite();
  lv_disp_flush_ready(driver);
}

// This panel's raw readings, mapped to the landscape screen.
static void readTouch(lv_indev_drv_t*, lv_indev_data_t* data) {
  if (touch.tirqTouched() && touch.touched()) {
    TS_Point p = touch.getPoint();
    data->point.x = constrain(map(p.x, 200, 3700, 0, W), 0, W - 1);
    data->point.y = constrain(map(p.y, 240, 3800, 0, H), 0, H - 1);
    data->state = LV_INDEV_STATE_PR;
  } else {
    data->state = LV_INDEV_STATE_REL;
  }
}

// ---------- shared between the Drive task and the screen ----------
static SemaphoreHandle_t lock;
static QueueHandle_t toggles;  // task ids (char[65]) tapped on screen

struct Shared {
  bool hasDay = false;
  bool dayChanged = false;
  planner::Day day;
  bool linkChanged = true;
  lowstate::Link link = lowstate::Link::Connecting;
  bool messageChanged = false;
  String messageTitle, messageDetail;
} shared;

static planner::Day shown;  // what's on screen (loop() only)
static bool showingDay = false;
static bool redrawShown = false;  // a tap changed `shown`; redraw after the event

static void setLink(lowstate::Link link) {
  xSemaphoreTake(lock, portMAX_DELAY);
  shared.link = link;
  shared.linkChanged = true;
  xSemaphoreGive(lock);
}

static void setMessage(const String& title, const String& detail) {
  xSemaphoreTake(lock, portMAX_DELAY);
  shared.messageTitle = title;
  shared.messageDetail = detail;
  shared.messageChanged = true;
  xSemaphoreGive(lock);
}

// ---------- time ----------
static bool clockSet() {
  return time(nullptr) > 1700000000;  // after 2023: NTP has answered
}

static std::string todayIso() {
  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);
  return planner::isoDate(local.tm_year + 1900, local.tm_mon + 1, local.tm_mday);
}

static int nowMinutes() {
  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);
  return local.tm_hour * 60 + local.tm_min;
}

static int64_t nowMs() {
  return static_cast<int64_t>(time(nullptr)) * 1000;
}

static time_t todayMidnight() {
  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);
  local.tm_hour = local.tm_min = local.tm_sec = 0;
  return mktime(&local);
}

static std::string newId() {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof bytes);
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  char text[37];
  snprintf(text, sizeof text, "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
  return text;
}

// ---------- Drive task ----------
static drive::Files files;

static planner::Day dayFrom(JsonArrayConst items, JsonArrayConst categories) {
  const time_t midnight = todayMidnight();
  return planner::buildDay(items, categories, files.agenda["events"].as<JsonArrayConst>(), todayIso(), nowMinutes(),
                           [midnight](int64_t epoch) {
                             const int64_t diff = epoch - static_cast<int64_t>(midnight);
                             return static_cast<int>(diff >= 0 ? diff / 60 : -((-diff + 59) / 60));
                           });
}

static void publishDay(const planner::Day& day) {
  xSemaphoreTake(lock, portMAX_DELAY);
  shared.day = day;
  shared.hasDay = true;
  shared.dayChanged = true;
  xSemaphoreGive(lock);
}

static bool reportProblem(drive::Result result) {
  if (result == drive::Result::Ok) return false;
  setLink(result == drive::Result::NoNetwork ? lowstate::Link::Offline : lowstate::Link::Error);
  bool hasDay;
  xSemaphoreTake(lock, portMAX_DELAY);
  hasDay = shared.hasDay;
  xSemaphoreGive(lock);
  if (!hasDay) {
    if (result == drive::Result::SignedOut) setMessage("O Google pediu login de novo", "Rode scripts/lowstate-gadget.cjs no Mac e grave a placa.");
    else setMessage("Não consegui ler o Drive", drive::describe(result));
  }
  Serial.printf("Drive: %s\n", drive::describe(result));
  return true;
}

static void releaseTasks() {
  files.items.clear();
  files.items.shrink_to_fit();
  files.categories.clear();
  files.categories.shrink_to_fit();
}

static bool refresh() {
  setLink(lowstate::Link::Syncing);
  drive::Result result = drive::readAll(files);
  if (reportProblem(result)) return false;
  JsonDocument items, categories;
  deserializeJson(items, files.items);
  deserializeJson(categories, files.categories);
  const planner::Day day = dayFrom(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>());
  // The day is all the screen needs now; ticking reads Drive again anyway.
  items.clear();
  categories.clear();
  releaseTasks();
  Serial.printf("Drive: %d files, %s: %u tasks, %d done, next %s; heap %u\n", files.computers, day.date.c_str(),
                day.tasks.size(), day.done, day.next.has ? day.next.start.c_str() : "-", ESP.getFreeHeap());
  publishDay(day);
  setLink(lowstate::Link::Synced);
  return true;
}

// Writes JSON text as the inside of a JSON string ("…" escaped).
class EscapingPrint : public Print {
 public:
  explicit EscapingPrint(Print& out) : out_(out) {}
  size_t write(uint8_t c) override {
    if (c == '"' || c == '\\') { out_.write('\\'); out_.write(c); }
    else if (c < 0x20) out_.printf("\\u%04x", c);
    else out_.write(c);
    return 1;
  }

 private:
  Print& out_;
};

// This screen's file for the sync (desktop-sync.cjs ownFile): the tasks as
// one JSON string, with the time of the change. Written straight out, so
// the whole file is never held in memory.
static void writeOwnFile(Print& out, const JsonDocument& items, int64_t now) {
  out.printf("{\"app\":\"lowstate\",\"version\":1,\"device\":\"%s\",\"name\":\"%s\",\"platform\":\"esp32\","
             "\"savedAt\":%lld,\"keys\":{\"%s\":{\"value\":\"",
             GADGET_DEVICE, GADGET_NAME, static_cast<long long>(now), planner::ITEMS_KEY);
  EscapingPrint escaped(out);
  serializeJson(items, escaped);
  out.printf("\",\"at\":%lld,\"by\":\"%s\"}}}", static_cast<long long>(now), GADGET_DEVICE);
}

// Ticks a task on the latest data and writes this screen's file.
static void tick(const std::string& id) {
  setLink(lowstate::Link::Syncing);
  if (reportProblem(drive::readAll(files))) return;
  // The task list goes in Drive's own memory, and its text is let go, so the
  // shared heap is whole when the upload connects.
  JsonDocument items(drive::scratch());
  JsonDocument categories;
  const DeserializationError parsed = deserializeJson(items, files.items);
  deserializeJson(categories, files.categories);
  releaseTasks();
  // Never write a list that didn't fit whole: the computers would take it
  // as the newest and lose the tasks left out.
  if (parsed || !items.is<JsonArray>()) {
    Serial.printf("Tick: task list not read whole (%s)\n", parsed.c_str());
    reportProblem(drive::Result::Failed);
    return;
  }
  const int64_t now = nowMs();
  if (!planner::toggleItem(items.as<JsonArray>(), id, todayIso(), now, newId())) {
    Serial.printf("Tick: %s not in the task list\n", id.c_str());
    publishDay(dayFrom(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>()));
    setLink(lowstate::Link::Synced);
    return;
  }
  if (items.overflowed()) {
    Serial.println("Tick: no room to change the task list");
    reportProblem(drive::Result::Failed);
    return;
  }
  const planner::Day day = dayFrom(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>());
  categories.clear();

  const drive::Result written = drive::writeOwn(files, [&](Print& out) { writeOwnFile(out, items, now); });
  items.clear();
  if (reportProblem(written)) return;
  Serial.printf("Tick: %s written\n", id.c_str());
  publishDay(day);
  setLink(lowstate::Link::Synced);
}

static void driveTask(void*) {
  const unsigned long EVERY = 60UL * 1000;
  const unsigned long RETRY = 15UL * 1000;
  unsigned long last = 0;
  unsigned long wait = 0;
  bool first = true;
  for (;;) {
    // Update mode needs the heap the TLS connections would take.
    if (ota::active()) { vTaskDelay(pdMS_TO_TICKS(200)); continue; }
    byteco::process();
    if (WiFi.status() != WL_CONNECTED) {
      setLink(lowstate::Link::Offline);
      if (first) setMessage("Procurando o Wi-Fi...", WIFI_SSID);
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }
    if (!clockSet()) {
      if (first) setMessage("Acertando o relógio...", "");
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    if (first && wait == 0) setMessage("Lendo o Lowstate no Drive...", "");

    // The weather, every 15 minutes (a minute after a failed try).
    static unsigned long weatherAt = 0;
    static unsigned long weatherWait = 0;
    if (weatherAt == 0 || millis() - weatherAt >= weatherWait) {
      weatherWait = weather::fetch() ? 15UL * 60 * 1000 : 60UL * 1000;
      weatherAt = millis();
    }

    char id[65];
    if (xQueueReceive(toggles, id, 0) == pdTRUE) {
      tick(id);
      last = millis();
      wait = EVERY;
    } else if (millis() - last >= wait) {
      const bool ok = refresh();
      if (ok) first = false;
      last = millis();
      wait = ok ? EVERY : RETRY;
    }
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

// ---------- screen ----------
static void onToggle(const std::string& id) {
  // Shown at once (redrawn in loop(): the row being tapped can't be removed
  // inside its own event); the Drive task does the rest.
  for (planner::Task& task : shown.tasks) {
    if (task.id != id) continue;
    task.done = !task.done;
    shown.done += task.done ? 1 : -1;
  }
  for (planner::Task& task : shown.late) {
    if (task.id != id) continue;
    task.done = !task.done;
    shown.overdue += task.done ? -1 : 1;
  }
  redrawShown = true;
  char text[65] = {0};
  strncpy(text, id.c_str(), sizeof text - 1);
  xQueueSend(toggles, text, 0);
}

void setup() {
  Serial.begin(115200);
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, TFT_BACKLIGHT_ON);
  tft.init();
  tft.setRotation(1);
  // Some boards of this model come with a panel that shows colors inverted
  // (black as white); this one does.
  tft.invertDisplay(true);

  touchSpi.begin(TOUCH_CLK, TOUCH_MISO, TOUCH_MOSI, TOUCH_CS);
  touch.begin(touchSpi);
  touch.setRotation(1);

  lv_init();
  pixels = static_cast<lv_color_t*>(heap_caps_malloc(W * LINES * sizeof(lv_color_t), MALLOC_CAP_DMA | MALLOC_CAP_8BIT));
  lv_disp_draw_buf_init(&drawBuffer, pixels, nullptr, W * LINES);
  static lv_disp_drv_t display;
  lv_disp_drv_init(&display);
  display.hor_res = W;
  display.ver_res = H;
  display.flush_cb = flush;
  display.draw_buf = &drawBuffer;
  lv_disp_drv_register(&display);
  static lv_indev_drv_t pointer;
  lv_indev_drv_init(&pointer);
  pointer.type = LV_INDEV_TYPE_POINTER;
  pointer.read_cb = readTouch;
  lv_indev_drv_register(&pointer);

  lock = xSemaphoreCreateMutex();
  toggles = xQueueCreate(8, 65);
  byteco::begin();
  lowstate::begin(onToggle);
  home::begin();
  lv_scr_load(home::screen());

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTzTime(GADGET_TZ, "time.google.com", "pool.ntp.org");

  xTaskCreatePinnedToCore(driveTask, "drive", 20 * 1024, nullptr, 1, nullptr, 0);
}

// ---------- development over USB ----------
// One letter on the serial port: s = screenshot (the screen drawn again,
// each piece sent as LVGL drew it; gadget/tools/screenshot.py), h = home,
// 1..9 = open that tool, t = open the first task's card, b = close it,
// k = tick the last task on the list (as its card's button would),
// m = ask Byteco for motivation, u = turn on update mode (Wi-Fi OTA),
// r = time a full redraw of the screen.
static void screenshot() {
  // The whole screen is drawn again, and flush() sends every piece.
  Serial.printf("SHOT %d %d\n", W, H);
  capturing = true;
  lv_obj_invalidate(lv_scr_act());
  lv_refr_now(nullptr);
  capturing = false;
  Serial.println("END");
}

static void serialCommands() {
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == 's') screenshot();
    else if (c == 'h') nav::home();
    else if (c >= '1' && c <= '9' && static_cast<size_t>(c - '1') < APP_COUNT) nav::open(APPS[c - '1']);
    else if (c == 'm') apartment::motivate();
    else if (c == 'u') ota::enable();
    else if (c == 't') lowstate::openTask(0);
    else if (c == 'b') lowstate::closeTask();
    else if (c == 'k' && !shown.tasks.empty()) onToggle(shown.tasks.back().id);  // tick the last task
    else if (c == 'r') {  // how long a full redraw of this screen takes
      const unsigned long start = micros();
      lv_obj_invalidate(lv_scr_act());
      lv_refr_now(nullptr);
      lv_mem_monitor_t mem;
      lv_mem_monitor(&mem);
      Serial.printf("REDRAW %lu ms (LVGL memory: %u used, %u max of %u; heap %u, largest %u)\n", (micros() - start) / 1000,
                    static_cast<unsigned>(mem.total_size - mem.free_size), static_cast<unsigned>(mem.max_used),
                    static_cast<unsigned>(mem.total_size), static_cast<unsigned>(ESP.getFreeHeap()),
                    static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
    }
  }
}

void loop() {
  ota::poll();
  serialCommands();
  xSemaphoreTake(lock, portMAX_DELAY);
  const bool dayChanged = shared.dayChanged;
  const bool linkChanged = shared.linkChanged;
  const bool messageChanged = shared.messageChanged && !shared.hasDay;
  planner::Day day;
  if (dayChanged) day = shared.day;
  const lowstate::Link link = shared.link;
  const String title = shared.messageTitle, detail = shared.messageDetail;
  shared.dayChanged = shared.linkChanged = shared.messageChanged = false;
  xSemaphoreGive(lock);

  if (dayChanged) {
    shown = day;
    showingDay = true;
    lowstate::showDay(shown);
  } else if (messageChanged && !showingDay) {
    lowstate::showMessage(title.c_str(), detail.c_str());
  }
  if (linkChanged) lowstate::showLink(link);

  lv_timer_handler();
  if (redrawShown) {
    redrawShown = false;
    lowstate::showDay(shown);
  }
  delay(5);
}
