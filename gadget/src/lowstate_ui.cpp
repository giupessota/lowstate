#include "lowstate_ui.h"

#include "apps.h"

#include <lvgl.h>

#include <cstdio>
#include <cstdlib>
#include <vector>

LV_FONT_DECLARE(dm_sans_14);
LV_FONT_DECLARE(dm_sans_16);
LV_FONT_DECLARE(dm_sans_bold_12);
LV_FONT_DECLARE(dm_sans_bold_22);

namespace lowstate {

// ---------- Lowstate at night ----------
// Navy grid paper with light ink: cyan for what must be done today, gold
// for the rest. (It began as the paper look shown on a panel that inverted
// colors, and stayed because it looked good on the desk.)
static const lv_color_t PAPER = lv_color_hex(0x0B0F17);
static const lv_color_t CARD = lv_color_hex(0x121826);
static const lv_color_t GRID = lv_color_hex(0x161C29);
static const lv_color_t RULE = lv_color_hex(0x1F2634);
static const lv_color_t INK = lv_color_hex(0xD5D9DF);
static const lv_color_t GOLD = lv_color_hex(0xCBAF75);
static const lv_color_t CYAN = lv_color_hex(0x29B5CD);
static const lv_color_t FADED = lv_color_hex(0x5C616B);
static const lv_color_t GREEN = lv_color_hex(0x6FCF97);
static const lv_color_t LATE = lv_color_hex(0xFF5C6C);  // overdue: the home tile's red

static const int W = 320;
static const int GRID_STEP = 16;

static ToggleHandler toggleHandler = nullptr;
static lv_obj_t* root;
static std::string statusLine;  // for the home tile, e.g. "2 ATRASADAS" or "2/5 FEITAS"
static uint32_t tileTint = 0;   // the home tile's color, 0 until the first day
static std::string shownDate;   // the day on screen (overdue tasks have earlier dates)
static lv_obj_t* dateLabel;
static lv_obj_t* countLabel;
static lv_obj_t* progressBand;
static int progressValue = -1;  // for the home tile
static lv_obj_t* linkDot;
static lv_obj_t* nextCard;
static lv_obj_t* nextStripe;
static lv_obj_t* nextWhen;
static lv_obj_t* nextTitle;
static lv_obj_t* list;

// The tasks in the rows on screen (row user data is the index here).
static std::vector<planner::Task> rowTasks;
static lv_obj_t* detail = nullptr;  // the open task card, if any

// ---------- grid paper ----------
static void drawGrid(lv_event_t* event) {
  // Only the lines that cross the piece of screen being drawn now.
  lv_draw_ctx_t* ctx = lv_event_get_draw_ctx(event);
  const lv_area_t* clip = ctx->clip_area;
  lv_draw_rect_dsc_t line;
  lv_draw_rect_dsc_init(&line);
  line.bg_color = GRID;
  line.bg_opa = LV_OPA_COVER;
  const lv_coord_t first = GRID_STEP / 2;
  for (lv_coord_t x = first + ((clip->x1 - first + GRID_STEP - 1) / GRID_STEP) * GRID_STEP; x <= clip->x2; x += GRID_STEP) {
    const lv_area_t area = {x, clip->y1, x, clip->y2};
    lv_draw_rect(ctx, &line, &area);
  }
  for (lv_coord_t y = first + ((clip->y1 - first + GRID_STEP - 1) / GRID_STEP) * GRID_STEP; y <= clip->y2; y += GRID_STEP) {
    const lv_area_t area = {clip->x1, y, clip->x2, y};
    lv_draw_rect(ctx, &line, &area);
  }
}

static lv_obj_t* plain(lv_obj_t* parent) {
  lv_obj_t* obj = lv_obj_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
  return obj;
}

static lv_obj_t* text(lv_obj_t* parent, const lv_font_t* font, lv_color_t color, const char* value = "") {
  lv_obj_t* label = lv_label_create(parent);
  lv_obj_set_style_text_font(label, font, 0);
  lv_obj_set_style_text_color(label, color, 0);
  lv_label_set_text(label, value);
  return label;
}

// A category's ink, lightened to read on the navy paper.
static lv_color_t parseColor(const std::string& hex, lv_color_t fallback) {
  if (hex.size() != 7 || hex[0] != '#') return fallback;
  return lv_color_lighten(lv_color_hex(static_cast<uint32_t>(std::strtoul(hex.c_str() + 1, nullptr, 16))), LV_OPA_40);
}

// "sexta, 13 nov"
static std::string longDate(const std::string& iso) {
  static const char* days[] = {"domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"};
  static const char* months[] = {"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"};
  int y, m, d;
  if (!planner::parseIso(iso, y, m, d)) return "Lowstate";
  char out[32];
  std::snprintf(out, sizeof out, "%s, %d %s", days[planner::weekday(iso)], d, months[m - 1]);
  return out;
}

// ---------- building the screen ----------
static void homeClicked(lv_event_t*) { nav::home(); }
static void closeDetail();

// Swiping right goes back: from a task's card to the list, from the list home.
static void swiped(lv_event_t*) {
  if (lv_indev_get_gesture_dir(lv_indev_get_act()) != LV_DIR_RIGHT) return;
  if (detail) closeDetail();
  else nav::home();
}

void begin(ToggleHandler onToggle) {
  toggleHandler = onToggle;
  root = lv_obj_create(nullptr);
  lv_obj_t* screen = root;
  lv_obj_set_style_bg_color(screen, PAPER, 0);
  lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);
  lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_event_cb(screen, drawGrid, LV_EVENT_DRAW_MAIN, nullptr);
  lv_obj_add_event_cb(screen, swiped, LV_EVENT_GESTURE, nullptr);

  // The cover's edge on top doubles as the day's progress: indigo fills it
  // as tasks get done.
  progressBand = lv_bar_create(screen);
  lv_obj_set_size(progressBand, W, 4);
  lv_obj_set_pos(progressBand, 0, 0);
  lv_bar_set_range(progressBand, 0, 100);
  lv_obj_set_style_radius(progressBand, 0, LV_PART_MAIN);
  lv_obj_set_style_radius(progressBand, 0, LV_PART_INDICATOR);
  lv_obj_set_style_bg_color(progressBand, RULE, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(progressBand, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_bg_color(progressBand, GOLD, LV_PART_INDICATOR);
  lv_obj_set_style_bg_opa(progressBand, LV_OPA_COVER, LV_PART_INDICATOR);  // no default theme

  // Back to the home screen.
  lv_obj_t* homeButton = plain(screen);
  lv_obj_add_flag(homeButton, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(homeButton, 0, 4);
  lv_obj_set_size(homeButton, 40, 36);
  lv_obj_set_style_radius(homeButton, 6, 0);
  lv_obj_set_style_bg_color(homeButton, RULE, LV_STATE_PRESSED);
  lv_obj_set_style_bg_opa(homeButton, LV_OPA_COVER, LV_STATE_PRESSED);
  lv_obj_add_event_cb(homeButton, homeClicked, LV_EVENT_CLICKED, nullptr);
  lv_obj_center(text(homeButton, &lv_font_montserrat_20, GOLD, LV_SYMBOL_HOME));

  dateLabel = text(screen, &dm_sans_bold_22, INK, "Lowstate");
  lv_obj_set_pos(dateLabel, 40, 7);

  countLabel = text(screen, &dm_sans_bold_12, FADED, "");
  lv_obj_set_style_text_letter_space(countLabel, 1, 0);
  lv_obj_align(countLabel, LV_ALIGN_TOP_RIGHT, -12, 15);

  // Sync state: matcha when Drive answered, indigo while talking, red on trouble.
  linkDot = plain(screen);
  lv_obj_set_size(linkDot, 7, 7);
  lv_obj_set_style_radius(linkDot, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_opa(linkDot, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(linkDot, FADED, 0);
  lv_obj_align_to(linkDot, countLabel, LV_ALIGN_OUT_LEFT_MID, -6, 0);

  // What's next on the timeline.
  nextCard = plain(screen);
  lv_obj_set_pos(nextCard, 10, 40);
  lv_obj_set_size(nextCard, W - 20, 48);
  lv_obj_set_style_bg_color(nextCard, CARD, 0);
  lv_obj_set_style_bg_opa(nextCard, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(nextCard, 8, 0);
  lv_obj_set_style_border_width(nextCard, 1, 0);
  lv_obj_set_style_border_color(nextCard, RULE, 0);
  lv_obj_set_style_shadow_width(nextCard, 10, 0);
  lv_obj_set_style_shadow_ofs_y(nextCard, 2, 0);
  lv_obj_set_style_shadow_opa(nextCard, LV_OPA_50, 0);
  lv_obj_set_style_shadow_color(nextCard, lv_color_black(), 0);

  nextStripe = plain(nextCard);
  lv_obj_set_size(nextStripe, 4, 32);
  lv_obj_set_pos(nextStripe, 10, 8);
  lv_obj_set_style_radius(nextStripe, 2, 0);
  lv_obj_set_style_bg_opa(nextStripe, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(nextStripe, GOLD, 0);

  nextWhen = text(nextCard, &dm_sans_bold_12, GOLD, "");
  lv_obj_set_style_text_letter_space(nextWhen, 1, 0);
  lv_obj_set_pos(nextWhen, 22, 6);

  nextTitle = text(nextCard, &dm_sans_16, INK, "");
  lv_label_set_long_mode(nextTitle, LV_LABEL_LONG_DOT);
  lv_obj_set_width(nextTitle, W - 20 - 34);
  lv_obj_set_pos(nextTitle, 22, 22);

  // The day's tasks, scrolling under the card.
  list = plain(screen);
  lv_obj_add_flag(list, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(list, LV_DIR_VER);
  lv_obj_set_scrollbar_mode(list, LV_SCROLLBAR_MODE_ACTIVE);
  lv_obj_set_pos(list, 0, 94);
  lv_obj_set_size(list, W, 240 - 94);
  lv_obj_set_style_pad_hor(list, 10, 0);
  lv_obj_set_style_pad_bottom(list, 6, 0);
  lv_obj_set_flex_flow(list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_bg_color(list, GOLD, LV_PART_SCROLLBAR);
  lv_obj_set_style_bg_opa(list, LV_OPA_40, LV_PART_SCROLLBAR);
  lv_obj_set_style_width(list, 3, LV_PART_SCROLLBAR);

  showMessage("Abrindo o caderno...", "");
}

static void openDetail(const planner::Task& task);

static void rowClicked(lv_event_t* event) {
  const size_t index = reinterpret_cast<size_t>(lv_event_get_user_data(event));
  if (index < rowTasks.size()) openDetail(rowTasks[index]);
}

static void addSection(const char* title, int count, lv_color_t color) {
  char label[40];
  std::snprintf(label, sizeof label, "%s  %d", title, count);
  lv_obj_t* head = text(list, &dm_sans_bold_12, color, label);
  lv_obj_set_style_text_letter_space(head, 1, 0);
  lv_obj_set_style_pad_top(head, 10, 0);
  lv_obj_set_style_pad_bottom(head, 2, 0);
}

// A small ink stamp: urgent (filled), a category (outlined in its color).
static lv_obj_t* stamp(lv_obj_t* parent, const char* label, lv_color_t color, bool filled) {
  lv_obj_t* tag = text(parent, &dm_sans_bold_12, filled ? PAPER : color, label);
  lv_label_set_long_mode(tag, LV_LABEL_LONG_DOT);
  lv_obj_set_style_max_width(tag, 120, 0);
  lv_obj_set_style_border_width(tag, 1, 0);
  lv_obj_set_style_border_color(tag, color, 0);
  lv_obj_set_style_radius(tag, 3, 0);
  lv_obj_set_style_pad_hor(tag, 4, 0);
  lv_obj_set_style_pad_ver(tag, 0, 0);
  if (filled) {
    lv_obj_set_style_bg_color(tag, color, 0);
    lv_obj_set_style_bg_opa(tag, LV_OPA_COVER, 0);
  }
  return tag;
}

// One task: checkbox, the title on up to two lines, and under it the
// stamps and the time.
// "sex 13/11", for overdue tasks.
static std::string shortDate(const std::string& iso) {
  static const char* days[] = {"dom", "seg", "ter", "qua", "qui", "sex", "sáb"};
  int y, m, d;
  if (!planner::parseIso(iso, y, m, d)) return iso;
  char out[16];
  std::snprintf(out, sizeof out, "%s %02d/%02d", days[planner::weekday(iso)], d, m);
  return out;
}

static bool isLate(const planner::Task& task) { return !task.date.empty() && task.date < shownDate; }

static void addRow(const planner::Task& task, size_t index) {
  static const int ROW_W = W - 20;           // list padding
  static const int TITLE_W = ROW_W - 8 - 18 - 10;

  lv_obj_t* row = plain(list);
  lv_obj_set_width(row, lv_pct(100));
  lv_obj_set_height(row, LV_SIZE_CONTENT);
  lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
  lv_obj_set_style_pad_column(row, 10, 0);
  lv_obj_set_style_pad_hor(row, 4, 0);
  lv_obj_set_style_pad_ver(row, 7, 0);
  lv_obj_set_style_border_side(row, LV_BORDER_SIDE_BOTTOM, 0);
  lv_obj_set_style_border_width(row, 1, 0);
  lv_obj_set_style_border_color(row, RULE, 0);
  lv_obj_set_style_radius(row, 4, LV_STATE_PRESSED);
  lv_obj_set_style_bg_color(row, INK, LV_STATE_PRESSED);
  lv_obj_set_style_bg_opa(row, LV_OPA_10, LV_STATE_PRESSED);
  lv_obj_add_event_cb(row, rowClicked, LV_EVENT_CLICKED, reinterpret_cast<void*>(index));

  const bool late = isLate(task);
  const lv_color_t ink = late ? LATE : task.focus == "must" ? CYAN : GOLD;
  lv_obj_t* box = plain(row);
  lv_obj_set_size(box, 18, 18);
  lv_obj_set_style_translate_y(box, 1, 0);
  lv_obj_set_style_radius(box, 4, 0);
  lv_obj_set_style_border_width(box, 2, 0);
  lv_obj_set_style_border_color(box, task.done ? FADED : ink, 0);
  if (task.done) {
    lv_obj_set_style_bg_color(box, FADED, 0);
    lv_obj_set_style_bg_opa(box, LV_OPA_COVER, 0);
    lv_obj_center(text(box, &lv_font_montserrat_14, PAPER, LV_SYMBOL_OK));
  }

  lv_obj_t* body = plain(row);
  lv_obj_set_flex_grow(body, 1);
  lv_obj_set_height(body, LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(body, 4, 0);

  // The title, whole when it fits in two lines, else cut with "…".
  lv_obj_t* title = text(body, &dm_sans_16, task.done ? FADED : INK, task.title.c_str());
  lv_obj_set_width(title, lv_pct(100));
  const lv_coord_t lineHeight = lv_font_get_line_height(&dm_sans_16);
  lv_point_t size;
  lv_txt_get_size(&size, task.title.c_str(), &dm_sans_16, 0, 0, TITLE_W, LV_TEXT_FLAG_NONE);
  if (size.y > 2 * lineHeight) {
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_obj_set_height(title, 2 * lineHeight);
  } else {
    lv_label_set_long_mode(title, LV_LABEL_LONG_WRAP);
  }
  if (task.done) lv_obj_set_style_text_decor(title, LV_TEXT_DECOR_STRIKETHROUGH, 0);

  const bool urgent = task.urgent && !task.done;
  if (!late && !urgent && task.category.empty() && task.time.empty()) return;
  lv_obj_t* meta = plain(body);
  lv_obj_set_size(meta, lv_pct(100), LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(meta, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(meta, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(meta, 6, 0);
  if (late) text(meta, &dm_sans_bold_12, task.done ? FADED : LATE, shortDate(task.date).c_str());
  if (!task.time.empty()) {
    lv_obj_t* when = text(meta, &dm_sans_bold_12, task.done ? FADED : INK, task.time.c_str());
    lv_obj_set_style_text_opa(when, LV_OPA_70, 0);
  }
  if (urgent) stamp(meta, "URGENTE", CYAN, true);
  if (!task.category.empty()) stamp(meta, task.category.c_str(), task.done ? FADED : parseColor(task.color, GOLD), false);
}

// ---------- one task, in full ----------
// Tapping a row opens its card: the whole title, when, how often, the
// category and the notes; ticking happens here, on purpose.
static std::string detailId;

static const char* repeatLabel(const std::string& repeat) {
  if (repeat == "daily") return "todo dia";
  if (repeat == "weekdays") return "dias úteis";
  if (repeat == "weekly") return "toda semana";
  if (repeat == "biweekly") return "a cada 2 semanas";
  if (repeat == "monthly") return "todo mês";
  if (repeat == "yearly") return "todo ano";
  return "";
}

static std::string lengthLabel(int minutes) {
  char out[16];
  if (minutes < 60) std::snprintf(out, sizeof out, "%d min", minutes);
  else if (minutes % 60 == 0) std::snprintf(out, sizeof out, "%dh", minutes / 60);
  else std::snprintf(out, sizeof out, "%dh%02d", minutes / 60, minutes % 60);
  return out;
}

static void closeDetail() {
  if (!detail) return;
  lv_obj_clear_flag(detail, LV_OBJ_FLAG_GESTURE_BUBBLE);
  lv_obj_del_async(detail);  // may be called from inside the card's own buttons
  detail = nullptr;
}

static void backClicked(lv_event_t*) { closeDetail(); }

static void doneClicked(lv_event_t*) {
  if (toggleHandler && !detailId.empty()) toggleHandler(detailId);
  closeDetail();
}

static lv_obj_t* button(lv_obj_t* parent, lv_color_t fill, bool outlined) {
  lv_obj_t* btn = plain(parent);
  lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_radius(btn, 8, 0);
  lv_obj_set_style_bg_color(btn, outlined ? CARD : fill, 0);
  lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(btn, outlined ? 2 : 0, 0);
  lv_obj_set_style_border_color(btn, fill, 0);
  lv_obj_set_style_bg_color(btn, outlined ? RULE : lv_color_darken(fill, LV_OPA_20), LV_STATE_PRESSED);
  lv_obj_set_flex_flow(btn, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(btn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(btn, 8, 0);
  return btn;
}

static void openDetail(const planner::Task& task) {
  closeDetail();
  detailId = task.id;
  const bool late = isLate(task);
  const lv_color_t ink = late ? LATE : task.focus == "must" ? CYAN : GOLD;

  detail = plain(root);
  lv_obj_set_size(detail, W, 240);
  lv_obj_set_style_bg_color(detail, PAPER, 0);
  lv_obj_set_style_bg_opa(detail, LV_OPA_COVER, 0);
  lv_obj_add_flag(detail, LV_OBJ_FLAG_CLICKABLE);  // taps don't reach the list below
  lv_obj_add_event_cb(detail, drawGrid, LV_EVENT_DRAW_MAIN, nullptr);

  lv_obj_t* band = plain(detail);
  lv_obj_set_size(band, W, 3);
  lv_obj_set_style_bg_color(band, ink, 0);
  lv_obj_set_style_bg_opa(band, LV_OPA_COVER, 0);

  // Top: back, and which group the task is in.
  lv_obj_t* back = plain(detail);
  lv_obj_add_flag(back, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(back, 4, 6);
  lv_obj_set_size(back, 96, 30);
  lv_obj_set_style_radius(back, 6, 0);
  lv_obj_set_style_bg_color(back, RULE, LV_STATE_PRESSED);
  lv_obj_set_style_bg_opa(back, LV_OPA_COVER, LV_STATE_PRESSED);
  lv_obj_set_flex_flow(back, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(back, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_left(back, 6, 0);
  lv_obj_set_style_pad_column(back, 4, 0);
  text(back, &lv_font_montserrat_14, GOLD, LV_SYMBOL_LEFT);
  text(back, &dm_sans_16, GOLD, "Voltar");
  lv_obj_add_event_cb(back, backClicked, LV_EVENT_CLICKED, nullptr);

  lv_obj_t* group = text(detail, &dm_sans_bold_12, ink, late ? ("ATRASADA · " + shortDate(task.date)).c_str() : task.focus == "must" ? "PRECISO FAZER" : "POSSO FAZER");
  lv_obj_set_style_text_letter_space(group, 1, 0);
  lv_obj_align(group, LV_ALIGN_TOP_RIGHT, -12, 14);

  // The card: everything about the task, scrolling when the notes are long.
  lv_obj_t* card = plain(detail);
  lv_obj_set_pos(card, 10, 40);
  lv_obj_set_size(card, W - 20, 240 - 40 - 54);
  lv_obj_set_style_bg_color(card, CARD, 0);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(card, 8, 0);
  lv_obj_set_style_border_width(card, 1, 0);
  lv_obj_set_style_border_color(card, RULE, 0);
  lv_obj_set_style_pad_all(card, 12, 0);
  lv_obj_set_style_pad_row(card, 6, 0);
  lv_obj_add_flag(card, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(card, LV_DIR_VER);
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_bg_color(card, ink, LV_PART_SCROLLBAR);
  lv_obj_set_style_bg_opa(card, LV_OPA_40, LV_PART_SCROLLBAR);
  lv_obj_set_style_width(card, 3, LV_PART_SCROLLBAR);

  lv_obj_t* title = text(card, &dm_sans_bold_22, task.done ? FADED : INK, task.title.c_str());
  lv_obj_set_width(title, lv_pct(100));
  lv_label_set_long_mode(title, LV_LABEL_LONG_WRAP);
  if (task.done) lv_obj_set_style_text_decor(title, LV_TEXT_DECOR_STRIKETHROUGH, 0);

  // Stamps: urgent, category.
  if (task.urgent || !task.category.empty()) {
    lv_obj_t* stamps = plain(card);
    lv_obj_set_size(stamps, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(stamps, LV_FLEX_FLOW_ROW_WRAP);
    lv_obj_set_style_pad_column(stamps, 6, 0);
    lv_obj_set_style_pad_row(stamps, 4, 0);
    if (task.urgent) stamp(stamps, "URGENTE", CYAN, true);
    if (!task.category.empty()) stamp(stamps, task.category.c_str(), parseColor(task.color, GOLD), false);
  }

  // When and how often: "16:00 · 1h · toda semana".
  std::string when;
  if (!task.time.empty()) when = task.time;
  if (task.duration > 0 && !task.time.empty()) when += " · " + lengthLabel(task.duration);
  if (!task.repeat.empty()) when += (when.empty() ? "" : " · ") + std::string(repeatLabel(task.repeat));
  if (!when.empty()) text(card, &dm_sans_14, FADED, when.c_str());

  // Notes, when the task has them (the title is often the whole task).
  if (!task.notes.empty()) {
    lv_obj_t* rule = plain(card);
    lv_obj_set_size(rule, lv_pct(100), 1);
    lv_obj_set_style_bg_color(rule, RULE, 0);
    lv_obj_set_style_bg_opa(rule, LV_OPA_COVER, 0);

    lv_obj_t* notes = text(card, &dm_sans_14, INK, task.notes.c_str());
    lv_obj_set_width(notes, lv_pct(100));
    lv_label_set_long_mode(notes, LV_LABEL_LONG_WRAP);
  }

  // The one action.
  lv_obj_t* action = button(detail, task.done ? FADED : ink, task.done);
  lv_obj_set_pos(action, 10, 240 - 46);
  lv_obj_set_size(action, W - 20, 38);
  text(action, &lv_font_montserrat_14, task.done ? FADED : PAPER, task.done ? LV_SYMBOL_REFRESH : LV_SYMBOL_OK);
  text(action, &dm_sans_16, task.done ? INK : PAPER, task.done ? "Desmarcar" : "Marcar como feita");
  lv_obj_add_event_cb(action, doneClicked, LV_EVENT_CLICKED, nullptr);
}

static void showNextCard(bool shown) {
  static const int LIST_TOP_WITH_CARD = 94;
  static const int LIST_TOP = 40;
  if (shown) lv_obj_clear_flag(nextCard, LV_OBJ_FLAG_HIDDEN);
  else lv_obj_add_flag(nextCard, LV_OBJ_FLAG_HIDDEN);
  const int top = shown ? LIST_TOP_WITH_CARD : LIST_TOP;
  lv_obj_set_pos(list, 0, top);
  lv_obj_set_size(list, W, 240 - top);
}

void showDay(const planner::Day& day) {
  shownDate = day.date;
  lv_label_set_text(dateLabel, longDate(day.date).c_str());

  const int total = static_cast<int>(day.tasks.size());
  // The home tile: its color says how the day is, its line says why.
  char line[32];
  const planner::Light light = planner::lightFor(day);
  int urgent = 0;
  for (const planner::Task& task : day.tasks) urgent += task.urgent && !task.done;
  if (light == planner::Light::Red) std::snprintf(line, sizeof line, day.overdue == 1 ? "1 ATRASADA" : "%d ATRASADAS", day.overdue);
  else if (light == planner::Light::Amber) std::snprintf(line, sizeof line, urgent == 1 ? "1 URGENTE" : "%d URGENTES", urgent);
  else if (total) std::snprintf(line, sizeof line, "%d/%d FEITAS", day.done, total);
  else std::snprintf(line, sizeof line, "DIA LIVRE");
  statusLine = line;
  tileTint = light == planner::Light::Red ? 0xFF5C6C : light == planner::Light::Amber ? 0xFFB347 : 0x4BF2A0;
  char count[16];
  std::snprintf(count, sizeof count, "%d/%d", day.done, total);
  lv_label_set_text(countLabel, total ? count : "");
  lv_obj_align(countLabel, LV_ALIGN_TOP_RIGHT, -12, 15);
  lv_obj_align_to(linkDot, countLabel, LV_ALIGN_OUT_LEFT_MID, total ? -6 : 0, 0);
  progressValue = total ? day.done * 100 / total : -1;
  lv_bar_set_value(progressBand, total ? progressValue : 0, LV_ANIM_ON);

  // The next thing on the timeline; nothing → no card, the list moves up.
  showNextCard(day.next.has);
  if (day.next.has) {
    const lv_color_t accent = day.next.now ? CYAN : GOLD;
    char when[48];
    std::snprintf(when, sizeof when, "%s · %s–%s", day.next.now ? "AGORA" : "A SEGUIR", day.next.start.c_str(), day.next.end.c_str());
    lv_label_set_text(nextWhen, when);
    lv_obj_set_style_text_color(nextWhen, accent, 0);
    lv_obj_set_style_bg_color(nextStripe, accent, 0);
    lv_label_set_text(nextTitle, day.next.title.c_str());
  }

  const lv_coord_t scrolled = lv_obj_get_scroll_y(list);
  lv_obj_clean(list);
  rowTasks.clear();
  if (day.tasks.empty() && day.late.empty()) {
    lv_obj_t* empty = text(list, &dm_sans_16, FADED, "Nada pra hoje :)");
    lv_obj_set_width(empty, lv_pct(100));
    lv_obj_set_style_text_align(empty, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_pad_top(empty, 40, 0);
    return;
  }
  // Overdue first, as in the app: what the home tile's red is about.
  if (!day.late.empty()) {
    addSection("ATRASADAS", day.overdue, LATE);
    for (const planner::Task& task : day.late) {
      rowTasks.push_back(task);
      addRow(task, rowTasks.size() - 1);
    }
    if (day.overdue > static_cast<int>(day.late.size())) {
      char more[48];
      std::snprintf(more, sizeof more, "+ %d no app", day.overdue - static_cast<int>(day.late.size()));
      lv_obj_set_style_pad_top(text(list, &dm_sans_bold_12, FADED, more), 6, 0);
    }
    if (day.tasks.empty()) {
      lv_obj_t* none = text(list, &dm_sans_14, FADED, "Nada marcado pra hoje.");
      lv_obj_set_style_pad_top(none, 12, 0);
    }
  }
  int must = 0;
  for (const planner::Task& task : day.tasks) must += task.focus == "must";
  std::string section;
  for (const planner::Task& task : day.tasks) {
    if (task.focus != section) {
      section = task.focus;
      const bool isMust = section == "must";
      addSection(isMust ? "PRECISO FAZER" : "POSSO FAZER", isMust ? must : total - must, isMust ? CYAN : GOLD);
    }
    rowTasks.push_back(task);
    addRow(task, rowTasks.size() - 1);
  }
  lv_obj_update_layout(list);
  lv_obj_scroll_to_y(list, scrolled, LV_ANIM_OFF);
}

void showMessage(const char* title, const char* detail) {
  lv_obj_clean(list);
  rowTasks.clear();
  lv_obj_t* big = text(list, &dm_sans_16, INK, title);
  lv_obj_set_width(big, lv_pct(100));
  lv_obj_set_style_text_align(big, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_pad_top(big, 34, 0);
  if (detail && *detail) {
    lv_obj_t* small = text(list, &dm_sans_14, FADED, detail);
    lv_obj_set_width(small, lv_pct(100));
    lv_label_set_long_mode(small, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(small, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_pad_top(small, 6, 0);
  }
  showNextCard(false);
}

void showLink(Link link) {
  lv_color_t color = FADED;
  if (link == Link::Synced) color = GREEN;
  else if (link == Link::Syncing) color = GOLD;
  else if (link == Link::Error) color = CYAN;
  lv_obj_set_style_bg_color(linkDot, color, 0);
}

lv_obj_t* screen() { return root; }

void openTask(size_t index) {
  if (index < rowTasks.size()) openDetail(rowTasks[index]);
}

void closeTask() { closeDetail(); }

std::string status() { return statusLine; }

int progress() { return progressValue; }

uint32_t tint() { return tileTint; }

}  // namespace lowstate
