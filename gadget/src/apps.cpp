#include "apps.h"

#include "lowstate_ui.h"
#include "apartment.h"
#include "byteco_sprite.h"

// One line per tool, in the order of the tiles.
const App APPS[] = {
  {"LOWSTATE", LV_SYMBOL_LIST, 0x3FD8FF, lowstate::screen, lowstate::status, lowstate::progress, nullptr, lowstate::tint},
  {"BYTECO", nullptr, 0xE7A18F, apartment::screen, nullptr, nullptr, &byteco_sprite},
};

const size_t APP_COUNT = sizeof(APPS) / sizeof(APPS[0]);
