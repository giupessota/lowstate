#include "apartment.h"

#include <Arduino.h>
#include "apps.h"
#include "byteco.h"
#include "byteco_sprite.h"

LV_FONT_DECLARE(dm_sans_bold_12);
LV_FONT_DECLARE(dm_sans_14);
LV_FONT_DECLARE(dm_sans_bold_18);

namespace apartment {
namespace {
lv_obj_t* root = nullptr;
lv_obj_t* menu = nullptr;
lv_obj_t* answer = nullptr;
lv_obj_t* speech = nullptr;
lv_obj_t* status = nullptr;
lv_obj_t* again = nullptr;
lv_obj_t* againText = nullptr;
lv_obj_t* options = nullptr;
lv_obj_t* loading = nullptr;
byteco::Mode selected = byteco::Mode::Motivation;
bool pending = false;
bool showingReply = false;
unsigned long requestAt = 0;

// Plain widgets keep this small screen within LVGL's existing memory budget.
lv_obj_t* label(lv_obj_t* parent, const char* value, const lv_font_t* font, uint32_t color) {
  lv_obj_t* obj = lv_label_create(parent);
  lv_obj_set_style_text_font(obj, font, 0);
  lv_obj_set_style_text_color(obj, lv_color_hex(color), 0);
  lv_label_set_text(obj, value);
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
  return obj;
}

lv_obj_t* panel(lv_obj_t* parent, int x, int y, int w, int h) {
  lv_obj_t* obj = lv_obj_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_set_pos(obj, x, y);
  lv_obj_set_size(obj, w, h);
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
  return obj;
}

lv_obj_t* button(lv_obj_t* parent, const char* title, int x, int y, int w, int h,
                 lv_event_cb_t callback, void* data = nullptr) {
  lv_obj_t* obj = lv_btn_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_set_pos(obj, x, y);
  lv_obj_set_size(obj, w, h);
  lv_obj_set_style_radius(obj, 8, 0);
  lv_obj_set_style_bg_color(obj, lv_color_hex(0x364B4B), 0);
  lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(obj, lv_color_hex(0x58756B), LV_STATE_PRESSED);
  // A short wait is an explicit warm loading state, not a washed-out button.
  lv_obj_set_style_bg_color(obj, lv_color_hex(0xD7B27D), LV_STATE_DISABLED);
  lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(obj, callback, LV_EVENT_CLICKED, data);
  lv_obj_center(label(obj, title, &dm_sans_bold_12, 0xFFF0D5));
  return obj;
}

// Reopening always starts at the options, even if an older request is in flight.
void resetMenu() {
  showingReply = false;
  lv_obj_clear_flag(menu, LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_flag(answer, LV_OBJ_FLAG_HIDDEN);
  lv_label_set_text(status, "Escolha sua dose de Byteco.");
}

void showMenu(lv_event_t*) {
  resetMenu();
}

void ask(byteco::Mode mode) {
  if (!byteco::request(mode)) {
    lv_label_set_text(status, pending ? "Estou buscando. Pode voltar às opções."
                                          : "Mais um gole... aguarde alguns segundos.");
    return;
  }
  selected = mode;
  pending = true;
  showingReply = true;
  requestAt = millis();
  lv_obj_add_flag(menu, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(answer, LV_OBJ_FLAG_HIDDEN);
  lv_label_set_text(speech, "Consultando meu estoque de sarcasmo...");
  lv_obj_clear_flag(loading, LV_OBJ_FLAG_HIDDEN);
  lv_label_set_text(status, "Buscando uma resposta...");
  lv_obj_add_state(again, LV_STATE_DISABLED);
  lv_label_set_text(againText, "BUSCANDO");
  lv_obj_set_style_text_color(againText, lv_color_hex(0x463B2F), 0);
}

void picked(lv_event_t* event) {
  ask(static_cast<byteco::Mode>(reinterpret_cast<uintptr_t>(lv_event_get_user_data(event))));
}
void repeat(lv_event_t*) { ask(selected); }
void goHome(lv_event_t*) { nav::home(); }

void tick(lv_timer_t*) {
  if (lv_scr_act() != root) return;
  char phrase[384];
  bool online;
  if (byteco::take(phrase, sizeof(phrase), online)) {
    pending = false;
    if (showingReply) {
      lv_label_set_text(speech, phrase);
      lv_label_set_text(status, online ? "" : "SEM CONEXÃO • FRASE LOCAL");
    }
    lv_obj_add_flag(loading, LV_OBJ_FLAG_HIDDEN);
  }
  const unsigned long elapsed = millis() - requestAt;
  if (pending) {
    lv_label_set_text(againText, "BUSCANDO");
    lv_bar_set_value(loading, (millis() / 12) % 100, LV_ANIM_OFF);
    if (showingReply) {
      const char* dots[] = {"Buscando resposta.", "Buscando resposta..", "Buscando resposta..."};
      lv_label_set_text(status, dots[(millis() / 450) % 3]);
    }
  } else if (elapsed < 10000) {
    lv_label_set_text_fmt(againText, "MAIS EM %lus", (10000 - elapsed + 999) / 1000);
  } else {
    lv_label_set_text(againText, "MAIS UMA");
    lv_obj_clear_state(again, LV_STATE_DISABLED);
    lv_obj_set_style_text_color(againText, lv_color_hex(0xFFF0D5), 0);
  }
  lv_obj_center(againText);
}
}  // namespace

void motivate() {
  if (root && lv_scr_act() == root) ask(byteco::Mode::Motivation);
}

lv_obj_t* screen() {
  if (root) {
    resetMenu();
    return root;
  }
  root = lv_obj_create(nullptr);
  lv_obj_remove_style_all(root);
  lv_obj_set_style_bg_color(root, lv_color_hex(0xF0E4D0), 0);
  lv_obj_set_style_bg_opa(root, LV_OPA_COVER, 0);
  lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE);
  button(root, "< MENU", 6, 5, 57, 30, goHome);
  lv_obj_set_pos(label(root, "BYTECO", &dm_sans_bold_18, 0x35484B), 76, 10);
  lv_obj_set_pos(label(root, "Café e sinceridade.", &dm_sans_bold_12, 0x897360), 76, 32);

  lv_obj_t* portrait = lv_img_create(root);
  lv_img_set_src(portrait, &byteco_portrait);
  lv_obj_set_pos(portrait, 7, 54);
  lv_obj_clear_flag(portrait, LV_OBJ_FLAG_CLICKABLE);

  menu = panel(root, 130, 54, 184, 160);
  const char* names[] = {"ME MOTIVA", "TÁ DIFÍCIL", "ME DISTRAI"};
  for (uintptr_t i = 0; i < 3; ++i) {
    button(menu, names[i], 0, i * 55, 182, 47, picked, reinterpret_cast<void*>(i));
  }

  answer = panel(root, 130, 54, 184, 160);
  lv_obj_t* bubble = panel(answer, 0, 0, 182, 114);
  lv_obj_set_style_bg_color(bubble, lv_color_hex(0xFFF8EA), 0);
  lv_obj_set_style_bg_opa(bubble, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(bubble, 9, 0);
  lv_obj_set_style_border_width(bubble, 1, 0);
  lv_obj_set_style_border_color(bubble, lv_color_hex(0xB59B7B), 0);
  speech = label(bubble, "", &dm_sans_14, 0x35484B);
  lv_obj_set_width(speech, 162);
  lv_obj_set_style_text_align(speech, LV_TEXT_ALIGN_CENTER, 0);
  lv_label_set_long_mode(speech, LV_LABEL_LONG_WRAP);
  lv_obj_center(speech);
  loading = lv_bar_create(bubble);
  lv_obj_set_pos(loading, 10, 104);
  lv_obj_set_size(loading, 162, 3);
  lv_obj_set_style_bg_color(loading, lv_color_hex(0xE9DCC8), LV_PART_MAIN);
  lv_obj_set_style_bg_color(loading, lv_color_hex(0xA57B45), LV_PART_INDICATOR);
  // Without LVGL's default theme a bar has no opacity of its own.
  lv_obj_set_style_bg_opa(loading, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(loading, LV_OPA_COVER, LV_PART_INDICATOR);
  lv_obj_set_style_radius(loading, 2, LV_PART_MAIN);
  lv_obj_set_style_radius(loading, 2, LV_PART_INDICATOR);
  lv_obj_add_flag(loading, LV_OBJ_FLAG_HIDDEN);
  again = button(answer, "MAIS UMA", 0, 123, 93, 37, repeat);
  againText = lv_obj_get_child(again, 0);
  options = button(answer, "OPÇÕES", 99, 123, 83, 37, showMenu);
  lv_obj_add_flag(answer, LV_OBJ_FLAG_HIDDEN);

  status = label(root, "Escolha sua dose de Byteco.", &dm_sans_bold_12, 0x786653);
  lv_obj_set_pos(status, 8, 222);
  lv_timer_create(tick, 200, nullptr);
  return root;
}
}  // namespace apartment
