#include "weather.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include <cmath>

#include "secrets.h"
#include "tls_roots.h"

#ifndef GADGET_LAT
#define GADGET_LAT 0
#define GADGET_LON 0
#endif

namespace weather {

static portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
static Now last;

bool fetch() {
  if (WiFi.status() != WL_CONNECTED || (GADGET_LAT == 0 && GADGET_LON == 0)) return false;
  char url[256];
  snprintf(url, sizeof url,
           "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f"
           "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min"
           "&timezone=auto&forecast_days=1",
           static_cast<double>(GADGET_LAT), static_cast<double>(GADGET_LON));

  WiFiClientSecure client;
  client.setCACert(TLS_ROOTS);
  HTTPClient http;
  http.setTimeout(10000);
  http.useHTTP10(true);
  if (!http.begin(client, url)) return false;
  const int status = http.GET();
  if (status != 200) {
    Serial.printf("Weather -> %d\n", status);
    http.end();
    return false;
  }
  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, http.getStream());
  http.end();
  if (error || doc["current"].isNull()) {
    Serial.printf("Weather JSON: %s\n", error.c_str());
    return false;
  }

  Now now;
  now.has = true;
  now.temperature = static_cast<int>(std::lround(doc["current"]["temperature_2m"] | 0.0));
  now.code = doc["current"]["weather_code"] | -1;
  now.high = static_cast<int>(std::lround(doc["daily"]["temperature_2m_max"][0] | 0.0));
  now.low = static_cast<int>(std::lround(doc["daily"]["temperature_2m_min"][0] | 0.0));
  portENTER_CRITICAL(&lock);
  last = now;
  portEXIT_CRITICAL(&lock);
  Serial.printf("Weather: %d°C, code %d, %d/%d\n", now.temperature, now.code, now.low, now.high);
  return true;
}

Now current() {
  portENTER_CRITICAL(&lock);
  const Now now = last;
  portEXIT_CRITICAL(&lock);
  return now;
}

}  // namespace weather
