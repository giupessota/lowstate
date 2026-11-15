#pragma once
#include <lvgl.h>

// Byteco's conversation menu, created lazily from the launcher.
namespace apartment {
lv_obj_t* screen();
// Request motivation, also available over USB (m).
void motivate();
}
