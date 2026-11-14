#include "apps.h"

#include "lowstate_ui.h"

// One line per tool, in the order of the tiles.
const App APPS[] = {
  {"LOWSTATE", LV_SYMBOL_LIST, 0x3FD8FF, lowstate::screen, lowstate::status, lowstate::progress},
};

const size_t APP_COUNT = sizeof(APPS) / sizeof(APPS[0]);
