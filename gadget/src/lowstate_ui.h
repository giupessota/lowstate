// Lowstate's tool: today's page on navy grid paper, light ink, cyan for
// what must be done, gold for the rest, categories as ink stamps.
//
//   ┌ sexta, 13 nov                    ● 2/5 ◔ ┐
//   │ ▌ AGORA · 14:00–15:00                    │
//   │ ▌ Reunião de planejamento                │
//   │ PRECISO FAZER                            │
//   │ □ ! Revisar proposta          [Trabalho] │
//   │ □ Ligar pro banco                  16:00 │
//   │ POSSO FAZER                              │
//   └ ■ Regar as plantas (riscada)             ┘
#pragma once

#include <lvgl.h>

#include <cstddef>
#include <string>

#include "planner.h"

namespace lowstate {

enum class Link { Connecting, Synced, Syncing, Offline, Error };

using ToggleHandler = void (*)(const std::string& id);

void begin(ToggleHandler onToggle);
void showDay(const planner::Day& day);
// When there is no day to show yet (first start, no Wi-Fi, signed out).
void showMessage(const char* title, const char* detail);
void showLink(Link link);

// For the home screen (apps.cpp).
lv_obj_t* screen();
std::string status();
int progress();  // 0..100, -1 when the day has no tasks

// Development (serial commands in main.cpp): open/close a task's card.
void openTask(size_t index);
void closeTask();

}  // namespace lowstate
