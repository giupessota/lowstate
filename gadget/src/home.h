// The home screen: a big clock, the date, the weather, the Wi-Fi, and a tile per tool
// (apps.cpp), neon on dark graphite.
//
//   22:12                          27°
//                                19° / 31°
//   SEX 13 NOV  ·  SÃO PAULO               ◉
//   ┌───────────────┐ ┌─────────────┐
//   │ ≡ LOWSTATE    │ │      +      │
//   └ 2/5 FEITAS ▬▬╱┘ └            ╱┘
#pragma once

#include <lvgl.h>

namespace home {

void begin();
lv_obj_t* screen();

}  // namespace home
