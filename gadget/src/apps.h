// The tools on the home screen.
//
// Adding a tool:
//   1. write its screen in its own file, built once on lv_obj_create(nullptr)
//      (lowstate_ui.cpp is the example), with a way back: nav::home();
//   2. add one line to APPS in apps.cpp.
// The home screen lays the tiles out two by two and scrolls past four.
#pragma once

#include <lvgl.h>

#include <cstddef>
#include <cstdint>
#include <string>

struct App {
  const char* name;            // on the tile, e.g. "LOWSTATE"
  const char* symbol;          // LVGL symbol (LV_SYMBOL_...), drawn in Montserrat
  uint32_t color;              // the tile's neon
  lv_obj_t* (*screen)();       // the tool's screen
  std::string (*status)();     // a short live line for the tile (may be null)
  int (*progress)();           // 0..100 for the tile's bar, -1 for none (may be null)
  const lv_img_dsc_t* icon = nullptr;  // optional image instead of the symbol
};

extern const App APPS[];
extern const size_t APP_COUNT;

namespace nav {
void open(const App& app);
void home();
}  // namespace nav
