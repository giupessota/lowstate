#include "byteco.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ctime>
#include <cstring>

#include "byteco_protocol.h"
#include "byteco_prompts.h"
#include "tls_providers.h"
#if __has_include("byteco_secrets.h")
#include "byteco_secrets.h"
#endif
#ifndef OPENAI_API_KEY
#define OPENAI_API_KEY ""
#endif
#ifndef BYTECO_OPENAI_MODEL
#define BYTECO_OPENAI_MODEL "gpt-4.1-mini"
#endif

namespace byteco {
namespace {
// TLS data arrives in packets. A temporary empty socket is not JSON EOF.
class ResponseStream : public Stream {
 public:
  explicit ResponseStream(WiFiClient& client) : client_(client) {}
  int available() override { return client_.available(); }
  int read() override { return wait() ? client_.read() : -1; }
  int peek() override { return wait() ? client_.peek() : -1; }
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

struct Reply {
  char phrase[384];
  bool online;
};
QueueHandle_t requests = nullptr;
QueueHandle_t replies = nullptr;
bool waiting = false;  // UI thread only
unsigned long requestedAt = 0;
bool requestedBefore = false;
}

void begin() {
  requests = xQueueCreate(1, sizeof(uint8_t));
  replies = xQueueCreate(1, sizeof(Reply));
}

bool request(Mode mode) {
  if (!requests || !replies || waiting ||
      (requestedBefore && millis() - requestedAt < 10000)) return false;
  const uint8_t trigger = static_cast<uint8_t>(mode);
  if (xQueueSend(requests, &trigger, 0) != pdTRUE) return false;
  waiting = true;
  requestedBefore = true;
  requestedAt = millis();
  return true;
}

void process() {
  uint8_t trigger;
  if (!requests || !replies || xQueueReceive(requests, &trigger, 0) != pdTRUE) return;
  Reply reply = {};
  std::strcpy(reply.phrase, "Você consegue. Infelizmente, isso significa que vai ter que fazer.");
  if (trigger == static_cast<uint8_t>(Mode::Comfort))
    std::strcpy(reply.phrase, "O dia está uma porcaria. Pelo menos não precisamos chamar isso de oportunidade.");
  else if (trigger == static_cast<uint8_t>(Mode::Distraction))
    std::strcpy(reply.phrase, "Se reunião desse XP, você seria chefona ou só um NPC em sofrimento?");
  // An unknown mode still gets an answer (the local phrase), so the screen
  // never waits forever.
  if (trigger < 3 && WiFi.status() == WL_CONNECTED && time(nullptr) > 1700000000 && strlen(OPENAI_API_KEY)) {
    // This runs in the Drive worker, so the two TLS connections never overlap.
    WiFiClientSecure client;
    client.setCACert(OPENAI_TLS_ROOTS);
    client.setHandshakeTimeout(12);
    HTTPClient http;
    http.setConnectTimeout(10000);
    http.setTimeout(25000);
    http.useHTTP10(true);  // stream plain JSON instead of buffering the response
    if (http.begin(client, "https://api.openai.com/v1/responses")) {
      http.addHeader("Authorization", String("Bearer ") + OPENAI_API_KEY);
      http.addHeader("Content-Type", "application/json");
      JsonDocument body;
      buildRequest(body, BYTECO_OPENAI_MODEL, PROMPTS[trigger]);
      String payload;
      serializeJson(body, payload);
      body.clear();
      const time_t timestamp = time(nullptr);
      struct tm utc;
      gmtime_r(&timestamp, &utc);
      char clock[32];
      strftime(clock, sizeof(clock), "%Y-%m-%d %H:%M:%S", &utc);
      Serial.printf("Byteco direct UTC: %s\n", clock);
      const int status = http.POST(payload);
      payload = String();
      Serial.printf("Byteco direct: HTTP %d (heap %u)\n", status, static_cast<unsigned>(ESP.getFreeHeap()));
      if (status < 0) {
        char error[160];
        client.lastError(error, sizeof(error));
        Serial.printf("Byteco TLS: %s\n", error);
      }
      if (status == 200) {
        // Retain only completion status and message text; ignore all metadata.
        JsonDocument filter;
        filter["status"] = true;
        filter["output"][0]["type"] = true;
        filter["output"][0]["content"][0]["type"] = true;
        filter["output"][0]["content"][0]["text"] = true;
        JsonDocument doc;
        ResponseStream stream(http.getStream());
        stream.setTimeout(10000);
        const auto error = deserializeJson(doc, stream, DeserializationOption::Filter(filter));
        if (!error && extractPhrase(doc, reply.phrase, sizeof(reply.phrase))) {
          reply.online = true;
          Serial.println("Byteco direct: phrase ready");
        } else {
          Serial.println("Byteco direct: invalid or incomplete response");
        }
      }
      http.end();
    }
  }
  xQueueOverwrite(replies, &reply);
}

bool take(char* phrase, unsigned size, bool& online) {
  if (!replies || !phrase || size == 0) return false;
  Reply reply;
  if (xQueueReceive(replies, &reply, 0) != pdTRUE) return false;
  strlcpy(phrase, reply.phrase, size);
  online = reply.online;
  waiting = false;
  return true;
}
}  // namespace byteco
