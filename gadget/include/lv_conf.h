// LVGL 8.4 settings for the desk screen. Anything not set here keeps
// LVGL's default (lv_conf_internal.h).
#if 1
#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0

#define LV_MEM_CUSTOM 0
#define LV_MEM_SIZE (24U * 1024U)  // ~14 KB in use with a full day of tasks

#define LV_TICK_CUSTOM 1
#define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())

#define LV_DISP_DEF_REFR_PERIOD 20

// Shadows (the neon glow, the cards) are costly to compute: keep the masks.
#define LV_SHADOW_CACHE_SIZE 48
#define LV_GRAD_CACHE_DEF_SIZE 1024
#define LV_INDEV_DEF_READ_PERIOD 20
#define LV_DPI_DEF 130

#define LV_USE_LOG 0
#define LV_USE_PERF_MONITOR 0
#define LV_USE_MEM_MONITOR 0

// Montserrat only for LVGL's symbols (the check mark); text uses DM Sans.
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_DEFAULT &lv_font_montserrat_14

#define LV_USE_THEME_DEFAULT 1
#define LV_THEME_DEFAULT_DARK 0
#define LV_THEME_DEFAULT_GROW 0

#endif
#endif
