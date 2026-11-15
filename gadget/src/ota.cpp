#include "ota.h"

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include <lvgl.h>
#include <atomic>
#include <esp_ota_ops.h>

#if __has_include("ota_secrets.h")
#include "ota_secrets.h"
#endif
#ifndef GADGET_OTA_PASSWORD_HASH
#define GADGET_OTA_PASSWORD_HASH ""
#endif

LV_FONT_DECLARE(dm_sans_bold_12);
LV_FONT_DECLARE(dm_sans_bold_18);
namespace ota {
namespace {
const unsigned long WINDOW_MS = 5UL * 60 * 1000;

std::atomic<bool> updating{false};
std::atomic<bool> listening{false};
bool turnOff = false;         // set inside OTA callbacks, acted on in poll()
bool configured = false;      // callbacks set once
unsigned long until = 0;      // when update mode ends
lv_obj_t* overlay = nullptr;
lv_obj_t* message = nullptr;
lv_obj_t* hint = nullptr;

void tapped(lv_event_t*) {
  if (!updating.load()) disable();
}

void show(const char* text, const char* small = "") {
  if (!overlay) {
    overlay = lv_obj_create(lv_layer_top());
    lv_obj_remove_style_all(overlay);
    lv_obj_set_size(overlay, 292, 124);
    lv_obj_center(overlay);
    lv_obj_set_style_bg_color(overlay, lv_color_hex(0xF0E4D0), 0);
    lv_obj_set_style_bg_opa(overlay, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(overlay, 12, 0);
    lv_obj_add_flag(overlay, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(overlay, tapped, LV_EVENT_CLICKED, nullptr);
    message = lv_label_create(overlay);
    lv_obj_set_style_text_font(message, &dm_sans_bold_18, 0);
    lv_obj_set_style_text_color(message, lv_color_hex(0x35484B), 0);
    lv_obj_set_width(message, 260);
    lv_obj_set_style_text_align(message, LV_TEXT_ALIGN_CENTER, 0);
    hint = lv_label_create(overlay);
    lv_obj_set_style_text_font(hint, &dm_sans_bold_12, 0);
    lv_obj_set_style_text_color(hint, lv_color_hex(0x786653), 0);
    lv_obj_set_width(hint, 260);
    lv_obj_set_style_text_align(hint, LV_TEXT_ALIGN_CENTER, 0);
  }
  lv_label_set_text(message, text);
  lv_label_set_text(hint, small);
  lv_obj_align(message, LV_ALIGN_CENTER, 0, small[0] ? -18 : 0);
  lv_obj_align(hint, LV_ALIGN_BOTTOM_MID, 0, -8);
  lv_refr_now(nullptr);
}

void hide() {
  if (!overlay) return;
  lv_obj_del(overlay);
  overlay = message = hint = nullptr;
}

void configure() {
  if (configured) return;
  configured = true;
  ArduinoOTA.setHostname("byteco");
  ArduinoOTA.setPasswordHash(GADGET_OTA_PASSWORD_HASH);
  ArduinoOTA.onStart([] {
    updating.store(true);
    show("Atualizando...\nMantenha ligado.");
    Serial.println("OTA: update started");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    static unsigned last = 101;
    const unsigned percent = total ? static_cast<uint64_t>(progress) * 100 / total : 0;
    if (percent / 5 != last / 5 || (percent == 100 && last != 100)) {
      last = percent;
      char text[80];
      snprintf(text, sizeof(text), "Atualizando... %u%%\nMantenha ligado.", percent);
      show(text);
    }
  });
  ArduinoOTA.onEnd([] {
    show("Pronto!\nReiniciando...");
    Serial.println("OTA: update complete");
  });
  ArduinoOTA.onError([](ota_error_t error) {
    updating.store(false);
    Serial.printf("OTA: error %u\n", static_cast<unsigned>(error));
    // Authentication failures must not leave update mode (or its overlay) on;
    // it is switched off in poll(), outside ArduinoOTA's own call.
    turnOff = true;
  });
}
}  // namespace

bool active() { return listening.load(); }

void enable() {
  // Refuse to expose an unauthenticated updater if setup has not run.
  if (strlen(GADGET_OTA_PASSWORD_HASH) != 64) {
    Serial.println("OTA: not configured (run scripts/byteco-ota-setup.cjs)");
    return;
  }
  if (WiFi.status() != WL_CONNECTED) return;
  until = millis() + WINDOW_MS;
  if (listening.load()) return;
  configure();
  listening.store(true);  // the network worker pauses, freeing heap for OTA
  ArduinoOTA.begin();
  const esp_partition_t* partition = esp_ota_get_running_partition();
  Serial.printf("OTA ready: byteco.local (%s), slot %s\n", WiFi.localIP().toString().c_str(),
                partition ? partition->label : "unknown");
}

void disable() {
  if (!listening.load() || updating.load()) return;
  ArduinoOTA.end();
  listening.store(false);
  hide();
  Serial.println("OTA: update mode off");
}

void poll() {
  if (!listening.load()) return;
  ArduinoOTA.handle();
  if (updating.load()) return;
  if (turnOff) {
    turnOff = false;
    disable();
    return;
  }
  if (WiFi.status() != WL_CONNECTED || static_cast<long>(millis() - until) >= 0) {
    disable();
    return;
  }
  // Once a second: the address and the time left.
  static unsigned long shownAt = 0;
  if (overlay && millis() - shownAt < 1000) return;
  shownAt = millis();
  const unsigned long left = (until - millis()) / 1000;
  char text[64], small[64];
  snprintf(text, sizeof text, "Modo atualização\n%s", WiFi.localIP().toString().c_str());
  snprintf(small, sizeof small, "DESLIGA SOZINHO EM %lu:%02lu\nTOQUE AQUI PARA CANCELAR", left / 60, left % 60);
  show(text, small);
}
}  // namespace ota
