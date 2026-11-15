#include "drive.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "tls_providers.h"
#include "planner.h"
#include "secrets.h"

namespace drive {

static const char* TOKEN_URL = "https://oauth2.googleapis.com/token";
static const char* FILES_URL = "https://www.googleapis.com/drive/v3/files";
static const char* UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
static const char* DEVICE_PREFIX = "lowstate-device-";
static const char* AGENDA_NAME = "lowstate-agenda.json";

static String accessToken;
static unsigned long tokenUntil = 0;

// Where each computer's file is parsed: memory of its own, set aside at
// start. ArduinoJson doubles a string's room as it grows (8 KB, 16 KB…);
// on the shared heap, next to a TLS connection, an 11 KB task list found no
// 16 KB block. Here the last block grows in place, and the arena is emptied
// before each file.
class Arena : public ArduinoJson::Allocator {
 public:
  void reset() { used_ = 0; last_ = nullptr; }

  void* allocate(size_t size) override {
    const size_t need = (sizeof(size_t) + size + 3) & ~size_t(3);
    if (used_ + need > sizeof memory_) return nullptr;
    uint8_t* block = memory_ + used_;
    *reinterpret_cast<size_t*>(block) = size;
    used_ += need;
    last_ = block;
    return block + sizeof(size_t);
  }

  void deallocate(void* pointer) override {
    uint8_t* block = header(pointer);
    if (block && block == last_) { used_ = block - memory_; last_ = nullptr; }
  }

  void* reallocate(void* pointer, size_t size) override {
    uint8_t* block = header(pointer);
    if (!block) return allocate(size);
    if (block == last_) {  // the newest block: grow or shrink where it is
      const size_t need = (sizeof(size_t) + size + 3) & ~size_t(3);
      if ((block - memory_) + need > sizeof memory_) return nullptr;
      *reinterpret_cast<size_t*>(block) = size;
      used_ = (block - memory_) + need;
      return pointer;
    }
    const size_t old = *reinterpret_cast<size_t*>(block);
    void* moved = allocate(size);
    if (moved) memcpy(moved, pointer, old < size ? old : size);
    return moved;
  }

 private:
  uint8_t* header(void* pointer) {
    return pointer ? static_cast<uint8_t*>(pointer) - sizeof(size_t) : nullptr;
  }
  alignas(4) uint8_t memory_[24 * 1024];  // a 16 KB task list (doubled room) + categories
  size_t used_ = 0;
  uint8_t* last_ = nullptr;
};

static Arena arena;

const char* describe(Result result) {
  switch (result) {
    case Result::Ok: return "ok";
    case Result::NoNetwork: return "sem internet";
    case Result::SignedOut: return "Google recusou o login";
    default: return "Drive falhou";
  }
}

// Reads the answer as it arrives, waiting for slow packets instead of
// stopping at the first gap (a whole 20 KB file doesn't fit in one piece
// of memory next to the TLS connection).
class PatientStream : public Stream {
 public:
  explicit PatientStream(WiFiClient& client) : client_(client) {}
  int available() override { return client_.available(); }
  int peek() override { return wait() ? client_.peek() : -1; }
  int read() override { return wait() ? client_.read() : -1; }
  size_t readBytes(char* buffer, size_t length) {
    size_t count = 0;
    while (count < length) {
      const int c = read();
      if (c < 0) break;
      buffer[count++] = static_cast<char>(c);
    }
    return count;
  }
  size_t write(uint8_t) override { return 0; }

 private:
  bool wait() {
    const unsigned long start = millis();
    while (!client_.available()) {
      if (!client_.connected() || millis() - start > 10000) return false;
      delay(2);
    }
    return true;
  }
  WiFiClient& client_;
};

// One HTTPS request; `body` is filled with the answer.
static int request(const char* method, const String& url, const String& payload, const char* contentType,
                   String* body, JsonDocument* json = nullptr, JsonDocument* filter = nullptr) {
  WiFiClientSecure client;
  client.setCACert(GOOGLE_TLS_ROOTS);
  HTTPClient http;
  http.setTimeout(15000);
  http.useHTTP10(true);  // no chunked answers, so JSON can be read as it arrives
  if (!http.begin(client, url)) return -1;
  if (contentType) http.addHeader("Content-Type", contentType);
  if (accessToken.length() && url.indexOf(TOKEN_URL) != 0) http.addHeader("Authorization", "Bearer " + accessToken);
  const int status = http.sendRequest(method, payload);
  if (status < 0) {
    char tls[96] = "";
    client.lastError(tls, sizeof tls);
    Serial.printf("%s %s -> %s [%s] (heap %u, largest %u)\n", method, url.c_str(), HTTPClient::errorToString(status).c_str(), tls,
                  static_cast<unsigned>(ESP.getFreeHeap()), static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
  }
  if (status == 200 && json) {
    PatientStream stream(http.getStream());
    DeserializationError error = filter
      ? deserializeJson(*json, stream, DeserializationOption::Filter(*filter))
      : deserializeJson(*json, stream);
    if (error) {
      Serial.printf("JSON from %s: %s (heap %u, largest %u)\n", url.c_str(), error.c_str(), static_cast<unsigned>(ESP.getFreeHeap()),
                    static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
      http.end();
      return -2;
    }
  } else if (body) {
    *body = http.getString();
  } else if (status > 0 && status != 200) {
    Serial.printf("%s %s -> %d %s\n", method, url.c_str(), status, http.getString().c_str());
  }
  http.end();
  return status;
}

static String formEncode(const char* text) {
  String out;
  for (const char* c = text; *c; c++) {
    if (isalnum(static_cast<unsigned char>(*c)) || strchr("-_.~", *c)) out += *c;
    else { char hex[4]; snprintf(hex, sizeof hex, "%%%02X", static_cast<unsigned char>(*c)); out += hex; }
  }
  return out;
}

static Result ensureToken() {
  if (WiFi.status() != WL_CONNECTED) return Result::NoNetwork;
  if (accessToken.length() && millis() < tokenUntil) return Result::Ok;
  accessToken = "";
  const String form = String("client_id=") + formEncode(GOOGLE_CLIENT_ID) +
                      "&client_secret=" + formEncode(GOOGLE_CLIENT_SECRET) +
                      "&refresh_token=" + formEncode(GOOGLE_REFRESH_TOKEN) +
                      "&grant_type=refresh_token";
  JsonDocument answer;
  const int status = request("POST", TOKEN_URL, form, "application/x-www-form-urlencoded", nullptr, &answer);
  if (status == 400 || status == 401) return Result::SignedOut;
  if (status != 200 || !answer["access_token"].is<const char*>()) return status < 0 ? Result::NoNetwork : Result::Failed;
  accessToken = answer["access_token"].as<const char*>();
  const long seconds = answer["expires_in"] | 3600L;
  tokenUntil = millis() + (seconds - 120) * 1000UL;
  return Result::Ok;
}

// Runs a Drive call, signing in again once if the token expired meanwhile.
template <typename Call>
// A connection that fails right after another one is usually short of
// memory for a moment (Wi-Fi still holds the last packets), so it is tried
// again after a pause, up to three times.
static Result withToken(Call call) {
  int refreshed = 0;
  for (int attempt = 0; attempt < 4; attempt++) {
    Result ready = ensureToken();
    if (ready != Result::Ok) return ready;
    const int status = call();
    if (status == 200) return Result::Ok;
    if (status == 401 && refreshed++ == 0) { accessToken = ""; continue; }
    if (status == 401) return Result::SignedOut;
    if (status >= 0 || attempt == 3) return status < 0 ? Result::NoNetwork : Result::Failed;
    vTaskDelay(pdMS_TO_TICKS(1500));
  }
  return Result::NoNetwork;
}

Result readAll(Files& files) {
  JsonDocument listing;
  const String listUrl = String(FILES_URL) +
    "?spaces=appDataFolder&pageSize=100&fields=files(id%2Cname)"
    "&q=name%20contains%20%27lowstate-%27%20and%20trashed%20%3D%20false";
  Result listed = withToken([&] { return request("GET", listUrl, "", nullptr, nullptr, &listing); });
  if (listed != Result::Ok) return listed;

  // What the last read had is dropped first: memory is tight.
  files.items.clear();
  files.items.shrink_to_fit();
  files.categories.clear();
  files.categories.shrink_to_fit();
  files.agenda.clear();
  files.computers = 0;

  // First pass: of each computer's file, only when its tasks and categories
  // last changed (a few bytes), to find the newest of each. Holding one
  // file's tasks while downloading the next left TLS without memory.
  JsonDocument whenFilter;
  whenFilter["app"] = true;
  whenFilter["keys"][planner::ITEMS_KEY]["at"] = true;
  whenFilter["keys"][planner::CATEGORIES_KEY]["at"] = true;

  String itemsFrom, categoriesFrom;
  int64_t itemsAt = -1, categoriesAt = -1;
  int computers = 0;
  JsonDocument agenda;
  String ownId;
  const String ownName = String(DEVICE_PREFIX) + GADGET_DEVICE + ".json";
  for (JsonObject file : listing["files"].as<JsonArray>()) {
    const String id = file["id"] | "";
    const String name = file["name"] | "";
    const String url = String(FILES_URL) + "/" + id + "?alt=media";
    if (name == ownName) ownId = id;
    if (name == AGENDA_NAME) {
      Result got = withToken([&] { return request("GET", url, "", nullptr, nullptr, &agenda); });
      if (got != Result::Ok) return got;
    } else if (name.startsWith(DEVICE_PREFIX)) {
      arena.reset();
      JsonDocument when(&arena);
      Result got = withToken([&] { return request("GET", url, "", nullptr, nullptr, &when, &whenFilter); });
      if (got != Result::Ok) return got;
      if (String(when["app"] | "") != "lowstate") continue;
      computers++;
      const int64_t items = when["keys"][planner::ITEMS_KEY]["at"] | static_cast<int64_t>(-1);
      const int64_t categories = when["keys"][planner::CATEGORIES_KEY]["at"] | static_cast<int64_t>(-1);
      if (items > itemsAt) { itemsAt = items; itemsFrom = id; }
      if (categories > categoriesAt) { categoriesAt = categories; categoriesFrom = id; }
    }
  }

  // Second pass: the newest values, from the file(s) that have them.
  std::string items, categories;
  auto take = [&](const String& id, bool wantItems, bool wantCategories) {
    JsonDocument filter;
    if (wantItems) filter["keys"][planner::ITEMS_KEY]["value"] = true;
    if (wantCategories) filter["keys"][planner::CATEGORIES_KEY]["value"] = true;
    arena.reset();
    JsonDocument doc(&arena);
    const String url = String(FILES_URL) + "/" + id + "?alt=media";
    Result got = withToken([&] { return request("GET", url, "", nullptr, nullptr, &doc, &filter); });
    if (got != Result::Ok) return got;
    if (wantItems) items = doc["keys"][planner::ITEMS_KEY]["value"] | "";
    if (wantCategories) categories = doc["keys"][planner::CATEGORIES_KEY]["value"] | "";
    return Result::Ok;
  };
  if (itemsFrom.length()) {
    Result got = take(itemsFrom, true, categoriesFrom == itemsFrom);
    if (got != Result::Ok) return got;
  }
  if (categoriesFrom.length() && categoriesFrom != itemsFrom) {
    Result got = take(categoriesFrom, false, true);
    if (got != Result::Ok) return got;
  }
  arena.reset();

  files.items = std::move(items);
  files.categories = std::move(categories);
  files.computers = computers;
  files.agenda = std::move(agenda);
  files.ownId = ownId;
  return Result::Ok;
}

ArduinoJson::Allocator* scratch() {
  arena.reset();
  return &arena;
}

// Counts what would be written (for Content-Length).
class CountingPrint : public Print {
 public:
  size_t write(uint8_t) override { count++; return 1; }
  size_t write(const uint8_t*, size_t size) override { count += size; return size; }
  size_t count = 0;
};

// Gathers bytes into 512-byte TLS records instead of one record per byte.
class BufferedPrint : public Print {
 public:
  explicit BufferedPrint(Client& client) : client_(client) {}
  size_t write(uint8_t byte) override {
    buffer_[used_++] = byte;
    if (used_ == sizeof buffer_) flush();
    return 1;
  }
  void flush() override {
    if (used_) client_.write(buffer_, used_);
    used_ = 0;
  }

 private:
  Client& client_;
  uint8_t buffer_[512];
  size_t used_ = 0;
};

// A PATCH whose body is written straight into the connection, opened before
// the body is made, while the heap is at its fullest.
static int streamUpload(const String& path, const std::function<void(Print&)>& writeBody) {
  CountingPrint counter;
  writeBody(counter);
  WiFiClientSecure client;
  client.setCACert(GOOGLE_TLS_ROOTS);
  client.setTimeout(15000);  // milliseconds (Arduino-ESP32 3.x)
  if (!client.connect("www.googleapis.com", 443)) {
    char tls[96] = "";
    client.lastError(tls, sizeof tls);
    Serial.printf("PATCH %s -> connection refused [%s] (heap %u, largest %u)\n", path.c_str(), tls,
                  static_cast<unsigned>(ESP.getFreeHeap()), static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)));
    return -1;
  }
  client.printf("PATCH %s HTTP/1.1\r\nHost: www.googleapis.com\r\nAuthorization: Bearer %s\r\n"
                "Content-Type: application/json\r\nContent-Length: %u\r\nConnection: close\r\n\r\n",
                path.c_str(), accessToken.c_str(), static_cast<unsigned>(counter.count));
  BufferedPrint out(client);
  writeBody(out);
  out.flush();
  const String statusLine = client.readStringUntil('\n');  // "HTTP/1.1 200 OK"
  client.stop();
  const int space = statusLine.indexOf(' ');
  const int status = space > 0 ? statusLine.substring(space + 1).toInt() : -1;
  if (status != 200) Serial.printf("PATCH %s -> %d\n", path.c_str(), status);
  return status;
}

Result writeOwn(Files& files, const std::function<void(Print&)>& writeBody) {
  // The first time, an empty file with just its name; then its content.
  if (!files.ownId.length()) {
    const String name = String(DEVICE_PREFIX) + GADGET_DEVICE + ".json";
    const String metadata = "{\"name\":\"" + name + "\",\"parents\":[\"appDataFolder\"],\"mimeType\":\"application/json\"}";
    JsonDocument answer;
    const String url = String(FILES_URL) + "?fields=id";
    Result made = withToken([&] { return request("POST", url, metadata, "application/json", nullptr, &answer); });
    if (made != Result::Ok) return made;
    files.ownId = answer["id"] | "";
    if (!files.ownId.length()) return Result::Failed;
  }
  const String path = "/upload/drive/v3/files/" + files.ownId + "?uploadType=media";
  return withToken([&] { return streamUpload(path, writeBody); });
}

}  // namespace drive
