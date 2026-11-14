#include "home.h"

#include <WiFi.h>
#include <time.h>

#include <cstdio>
#include <string>

#include "apps.h"
#include "secrets.h"
#include "weather.h"

LV_FONT_DECLARE(dm_sans_bold_12);
LV_FONT_DECLARE(dm_sans_bold_18);
LV_FONT_DECLARE(dm_sans_bold_22);
LV_FONT_DECLARE(dm_sans_bold_32);
LV_FONT_DECLARE(dm_sans_bold_56);

#ifndef GADGET_PLACE
#define GADGET_PLACE ""
#endif

namespace home {

// ---------- neon on graphite ----------
static const lv_color_t NIGHT_TOP = lv_color_hex(0x15171B);
static const lv_color_t NIGHT_BOTTOM = lv_color_hex(0x08090B);
static const lv_color_t CYAN = lv_color_hex(0x7DF9FF);
static const lv_color_t PINK = lv_color_hex(0xFF6B8B);
static const lv_color_t GREEN = lv_color_hex(0x4BF2A0);
static const lv_color_t YELLOW = lv_color_hex(0xFFD166);
static const lv_color_t WHITE = lv_color_hex(0xEAF6FF);
static const lv_color_t DIM = lv_color_hex(0x33363D);
static const lv_color_t GRAY = lv_color_hex(0x8A9099);

static const int W = 320;
static const int SLOTS = 4;  // tiles shown even when there are fewer tools
static const int TILE_W = 145;
static const int TILE_H = 70;
static const int CUT = 10;  // the cut corner

static lv_obj_t* root;
static lv_obj_t* clock;
static lv_obj_t* dateLabel;
static lv_obj_t* wifiIcon;
static lv_obj_t* wifiLabel;
static lv_obj_t* tempLabel;
static lv_obj_t* skyLabel;
static lv_obj_t* placeLabel;
static lv_obj_t* statusLabels[16];
static lv_obj_t* progressBars[16];

static lv_obj_t* text(lv_obj_t* parent, const lv_font_t* font, lv_color_t color, const char* value) {
  lv_obj_t* label = lv_label_create(parent);
  lv_obj_set_style_text_font(label, font, 0);
  lv_obj_set_style_text_color(label, color, 0);
  lv_label_set_text(label, value);
  return label;
}

// ---------- tiles ----------
static void tileClicked(lv_event_t* event) {
  const size_t index = reinterpret_cast<size_t>(lv_event_get_user_data(event));
  if (index < APP_COUNT) nav::open(APPS[index]);
}

// The tile's outline in its neon: four straight sides (plain fills, cheap)
// and one short diagonal for the cut corner. A polyline with rounded joints
// looked the same and took five times longer to draw.
static void drawOutline(lv_event_t* event) {
  lv_obj_t* tile = lv_event_get_target(event);
  lv_draw_ctx_t* ctx = lv_event_get_draw_ctx(event);
  const bool used = reinterpret_cast<uintptr_t>(lv_event_get_user_data(event)) != 0;
  const lv_coord_t width = used ? 2 : 1;
  lv_area_t box;
  lv_obj_get_coords(tile, &box);

  lv_draw_rect_dsc_t side;
  lv_draw_rect_dsc_init(&side);
  side.bg_color = lv_obj_get_style_bg_color(tile, 0);
  side.bg_opa = used ? LV_OPA_COVER : LV_OPA_60;
  const lv_area_t top = {box.x1, box.y1, box.x2, static_cast<lv_coord_t>(box.y1 + width - 1)};
  const lv_area_t left = {box.x1, box.y1, static_cast<lv_coord_t>(box.x1 + width - 1), box.y2};
  const lv_area_t bottom = {box.x1, static_cast<lv_coord_t>(box.y2 - width + 1), static_cast<lv_coord_t>(box.x2 - CUT), box.y2};
  const lv_area_t right = {static_cast<lv_coord_t>(box.x2 - width + 1), box.y1, box.x2, static_cast<lv_coord_t>(box.y2 - CUT)};
  lv_draw_rect(ctx, &side, &top);
  lv_draw_rect(ctx, &side, &left);
  lv_draw_rect(ctx, &side, &bottom);
  lv_draw_rect(ctx, &side, &right);

  lv_draw_line_dsc_t cut;
  lv_draw_line_dsc_init(&cut);
  cut.color = side.bg_color;
  cut.opa = side.bg_opa;
  cut.width = width;
  const lv_point_t a = {static_cast<lv_coord_t>(box.x2 - CUT), static_cast<lv_coord_t>(box.y2 - width / 2)};
  const lv_point_t b = {static_cast<lv_coord_t>(box.x2 - width / 2), static_cast<lv_coord_t>(box.y2 - CUT)};
  lv_draw_line(ctx, &cut, &a, &b);
}

static void addTile(lv_obj_t* grid, int slot) {
  const bool used = slot < static_cast<int>(APP_COUNT);
  const App* app = used ? &APPS[slot] : nullptr;
  const lv_color_t color = used ? lv_color_hex(app->color) : DIM;

  lv_obj_t* tile = lv_obj_create(grid);
  lv_obj_remove_style_all(tile);
  lv_obj_clear_flag(tile, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(tile, TILE_W, TILE_H);
  lv_obj_set_style_bg_color(tile, color, 0);  // also the outline's color

  // The neon outline with its cut corner (drawOutline).
  lv_obj_add_event_cb(tile, drawOutline, LV_EVENT_DRAW_MAIN_END, reinterpret_cast<void*>(static_cast<uintptr_t>(used)));

  if (!used) {
    // A free slot: quiet, so the screen reads as room to grow.
    lv_obj_t* plus = text(tile, &lv_font_montserrat_20, DIM, LV_SYMBOL_PLUS);
    lv_obj_center(plus);
    return;
  }

  // Glow: a soft shadow in the tile's neon, and a faint tint inside.
  lv_obj_set_style_bg_opa(tile, LV_OPA_10, 0);
  lv_obj_set_style_bg_opa(tile, LV_OPA_30, LV_STATE_PRESSED);
  lv_obj_set_style_shadow_color(tile, color, 0);
  lv_obj_set_style_shadow_width(tile, 14, 0);
  lv_obj_set_style_shadow_spread(tile, 2, 0);
  lv_obj_set_style_shadow_opa(tile, LV_OPA_60, 0);
  lv_obj_add_flag(tile, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(tile, tileClicked, LV_EVENT_CLICKED, reinterpret_cast<void*>(static_cast<size_t>(slot)));

  lv_obj_t* icon = text(tile, &lv_font_montserrat_20, color, app->symbol);
  lv_obj_set_pos(icon, 12, 14);
  lv_obj_t* name = text(tile, &dm_sans_bold_18, WHITE, app->name);
  lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
  lv_obj_set_width(name, TILE_W - 40 - 8);
  lv_obj_set_pos(name, 40, 13);

  lv_obj_t* status = text(tile, &dm_sans_bold_12, color, "");
  lv_obj_set_style_text_letter_space(status, 1, 0);
  lv_obj_set_style_text_opa(status, LV_OPA_80, 0);
  lv_obj_set_pos(status, 12, 42);
  if (slot < 16) statusLabels[slot] = status;

  if (app->progress) {
    lv_obj_t* bar = lv_bar_create(tile);
    // Along the bottom, stopping before the cut corner.
    lv_obj_set_size(bar, TILE_W - 24 - CUT, 3);
    lv_obj_set_pos(bar, 12, TILE_H - 10);
    lv_bar_set_range(bar, 0, 100);
    lv_obj_set_style_bg_color(bar, color, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(bar, LV_OPA_20, LV_PART_MAIN);
    lv_obj_set_style_bg_color(bar, color, LV_PART_INDICATOR);
    lv_obj_set_style_radius(bar, 2, LV_PART_MAIN);
    lv_obj_set_style_radius(bar, 2, LV_PART_INDICATOR);
    if (slot < 16) progressBars[slot] = bar;
  }
}

// ---------- clock, date, Wi-Fi ----------
static void setIfChanged(lv_obj_t* label, const char* value) {
  if (std::string(lv_label_get_text(label)) != value) lv_label_set_text(label, value);
}

static void tick(lv_timer_t*) {
  static const char* days[] = {"DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"};
  static const char* months[] = {"JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"};
  const time_t now = time(nullptr);
  if (now > 1700000000) {
    struct tm local;
    localtime_r(&now, &local);
    char hhmm[6], date[16];
    std::snprintf(hhmm, sizeof hhmm, "%02d:%02d", local.tm_hour, local.tm_min);
    std::snprintf(date, sizeof date, "%s %d %s", days[local.tm_wday], local.tm_mday, months[local.tm_mon]);
    setIfChanged(clock, hhmm);
    setIfChanged(dateLabel, date);
  }

  // The first seconds after power-on are "connecting", not "no Wi-Fi".
  static bool everOnline = false;
  const bool online = WiFi.status() == WL_CONNECTED;
  everOnline = everOnline || online;
  const bool connecting = !online && !everOnline && millis() < 20000;
  const lv_color_t color = online ? GREEN : connecting ? CYAN : PINK;
  // Wi-Fi: just the icon while all is well; words only when it isn't.
  setIfChanged(wifiLabel, online ? "" : connecting ? "CONECTANDO" : "SEM WI-FI");
  lv_obj_set_style_text_color(wifiLabel, color, 0);
  lv_obj_set_style_text_color(wifiIcon, color, 0);
  lv_obj_align(wifiIcon, LV_ALIGN_TOP_RIGHT, -10, 62);
  lv_obj_align_to(wifiLabel, wifiIcon, LV_ALIGN_OUT_LEFT_MID, -6, 0);

  // Weather, on the right: the temperature, and under it the day's range.
  const weather::Now sky = weather::current();
  if (sky.has) {
    char temp[8], line[48];
    std::snprintf(temp, sizeof temp, "%d°", sky.temperature);
    std::snprintf(line, sizeof line, "%d° / %d°", sky.low, sky.high);
    setIfChanged(tempLabel, temp);
    setIfChanged(skyLabel, line);
  }
  lv_obj_align(tempLabel, LV_ALIGN_TOP_RIGHT, -10, 6);
  lv_obj_align(skyLabel, LV_ALIGN_TOP_RIGHT, -10, 42);

  // Date and place, quiet, under the clock.
  lv_obj_set_pos(dateLabel, 12, 63);
  lv_obj_align_to(placeLabel, dateLabel, LV_ALIGN_OUT_RIGHT_MID, 0, 0);

  for (size_t i = 0; i < APP_COUNT && i < 16; i++) {
    if (APPS[i].status && statusLabels[i]) setIfChanged(statusLabels[i], APPS[i].status().c_str());
    if (APPS[i].progress && progressBars[i]) {
      const int value = APPS[i].progress();
      if (value < 0) lv_obj_add_flag(progressBars[i], LV_OBJ_FLAG_HIDDEN);
      else {
        lv_obj_clear_flag(progressBars[i], LV_OBJ_FLAG_HIDDEN);
        if (lv_bar_get_value(progressBars[i]) != value) lv_bar_set_value(progressBars[i], value, LV_ANIM_ON);
      }
    }
  }
}

void begin() {
  root = lv_obj_create(nullptr);
  lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(root, NIGHT_TOP, 0);
  lv_obj_set_style_bg_grad_color(root, NIGHT_BOTTOM, 0);
  lv_obj_set_style_bg_grad_dir(root, LV_GRAD_DIR_VER, 0);
  lv_obj_set_style_bg_opa(root, LV_OPA_COVER, 0);

  clock = text(root, &dm_sans_bold_56, CYAN, "--:--");
  lv_obj_set_pos(clock, 10, 0);

  dateLabel = text(root, &dm_sans_bold_12, WHITE, "");
  lv_obj_set_style_text_letter_space(dateLabel, 2, 0);
  lv_obj_set_style_text_opa(dateLabel, LV_OPA_90, 0);
  std::string place = *GADGET_PLACE ? std::string("  ·  ") + GADGET_PLACE : "";
  placeLabel = text(root, &dm_sans_bold_12, GRAY, place.c_str());
  lv_obj_set_style_text_letter_space(placeLabel, 2, 0);

  wifiIcon = text(root, &lv_font_montserrat_14, CYAN, LV_SYMBOL_WIFI);
  wifiLabel = text(root, &dm_sans_bold_12, CYAN, "");
  lv_obj_set_style_text_letter_space(wifiLabel, 1, 0);

  tempLabel = text(root, &dm_sans_bold_32, YELLOW, "");
  skyLabel = text(root, &dm_sans_bold_12, YELLOW, "");
  lv_obj_set_style_text_letter_space(skyLabel, 1, 0);
  lv_obj_set_style_text_opa(skyLabel, LV_OPA_80, 0);

  lv_obj_t* grid = lv_obj_create(root);
  lv_obj_remove_style_all(grid);
  lv_obj_set_pos(grid, 0, 80);
  lv_obj_set_size(grid, W, 240 - 80);
  lv_obj_set_style_pad_hor(grid, 10, 0);
  lv_obj_set_style_pad_top(grid, 6, 0);
  lv_obj_set_style_pad_bottom(grid, 8, 0);
  lv_obj_set_style_pad_row(grid, 10, 0);
  lv_obj_set_style_pad_column(grid, 10, 0);
  lv_obj_set_flex_flow(grid, LV_FLEX_FLOW_ROW_WRAP);
  lv_obj_add_flag(grid, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(grid, LV_DIR_VER);
  lv_obj_set_scrollbar_mode(grid, LV_SCROLLBAR_MODE_ACTIVE);
  const int slots = APP_COUNT > SLOTS ? static_cast<int>(APP_COUNT + (APP_COUNT % 2)) : SLOTS;
  for (int slot = 0; slot < slots; slot++) addTile(grid, slot);

  tick(nullptr);
  lv_timer_create(tick, 1000, nullptr);
}

lv_obj_t* screen() { return root; }


}  // namespace home

namespace nav {

void open(const App& app) {
  lv_scr_load(app.screen());
}

void home() {
  lv_scr_load(home::screen());
}

}  // namespace nav
