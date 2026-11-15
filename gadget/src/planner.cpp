#include "planner.h"

#include <algorithm>
#include <cstdio>
#include <cstring>

namespace planner {

const char* const ITEMS_KEY = "type-todo.planner.items.v1";
const char* const CATEGORIES_KEY = "type-todo.planner.categories.v1";

// ---------- dates ----------
// Days since 1970-01-01 for a civil date and back (H. Hinnant's algorithms).
static int64_t daysFromCivil(int y, int m, int d) {
  y -= m <= 2;
  const int64_t era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int64_t>(doe) - 719468;
}

static void civilFromDays(int64_t z, int& y, int& m, int& d) {
  z += 719468;
  const int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  const unsigned doe = static_cast<unsigned>(z - era * 146097);
  const unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  const unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const unsigned mp = (5 * doy + 2) / 153;
  d = static_cast<int>(doy - (153 * mp + 2) / 5 + 1);
  m = static_cast<int>(mp < 10 ? mp + 3 : mp - 9);
  y = static_cast<int>(yoe + era * 400 + (m <= 2));
}

static int daysInMonth(int y, int m) {
  static const int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  const bool leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
  return m == 2 && leap ? 29 : days[m - 1];
}

bool parseIso(const std::string& iso, int& y, int& m, int& d) {
  if (iso.size() != 10 || iso[4] != '-' || iso[7] != '-') return false;
  if (std::sscanf(iso.c_str(), "%4d-%2d-%2d", &y, &m, &d) != 3) return false;
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

std::string isoDate(int y, int m, int d) {
  char text[11];
  std::snprintf(text, sizeof text, "%04d-%02d-%02d", y, m, d);
  return text;
}

std::string addDays(const std::string& iso, int days) {
  int y, m, d;
  if (!parseIso(iso, y, m, d)) return "";
  civilFromDays(daysFromCivil(y, m, d) + days, y, m, d);
  return isoDate(y, m, d);
}

int weekday(const std::string& iso) {
  int y, m, d;
  if (!parseIso(iso, y, m, d)) return -1;
  const int64_t days = daysFromCivil(y, m, d);  // 1970-01-01 was a Thursday
  return static_cast<int>(((days % 7) + 11) % 7);
}

// Same rules as planner.js nextOccurrence.
std::string nextOccurrence(const std::string& repeat, const std::string& iso, const std::string& anchorIso) {
  int y, m, d;
  if (!parseIso(iso, y, m, d)) return "";
  int ay, am, ad;
  if (!parseIso(anchorIso, ay, am, ad)) { ay = y; am = m; ad = d; }
  if (repeat == "daily") return addDays(iso, 1);
  if (repeat == "weekly") return addDays(iso, 7);
  if (repeat == "biweekly") return addDays(iso, 14);
  if (repeat == "weekdays") {
    std::string next = addDays(iso, 1);
    while (weekday(next) == 0 || weekday(next) == 6) next = addDays(next, 1);
    return next;
  }
  if (repeat != "monthly" && repeat != "yearly") return "";
  int targetYear, targetMonth;  // targetMonth 1..12
  if (repeat == "yearly") {
    targetYear = y + 1;
    targetMonth = am;
  } else {
    const int month0 = (m - 1) + 1;
    targetYear = y + month0 / 12;
    targetMonth = month0 % 12 + 1;
  }
  return isoDate(targetYear, targetMonth, std::min(ad, daysInMonth(targetYear, targetMonth)));
}

std::string nextUpcoming(const std::string& repeat, const std::string& date, const std::string& anchor, const std::string& today) {
  std::string next = nextOccurrence(repeat, date, anchor);
  for (int guard = 0; !next.empty() && next < today && guard < 1000; guard++) next = nextOccurrence(repeat, next, anchor);
  return next;
}

int64_t parseUtc(const char* text) {
  int y, mo, d, h, mi, s = 0;
  if (!text || std::sscanf(text, "%4d-%2d-%2dT%2d:%2d:%2d", &y, &mo, &d, &h, &mi, &s) < 5) return -1;
  if (!std::strchr(text, 'Z')) return -1;  // the app always stores UTC instants
  return daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + s;
}

static int timeToMinutes(const std::string& hhmm) {
  int h, m;
  if (std::sscanf(hhmm.c_str(), "%2d:%2d", &h, &m) != 2) return -1;
  return h * 60 + m;
}

static std::string minutesToTime(int minutes) {
  minutes = std::max(0, std::min(minutes, 1439));
  char text[6];
  std::snprintf(text, sizeof text, "%02d:%02d", minutes / 60, minutes % 60);
  return text;
}

// ---------- the day ----------
static std::string str(JsonVariantConst value) {
  const char* text = value.as<const char*>();
  return text ? text : "";
}

// planner.js compareInDay: open first, untimed before timed, by time, by
// the order in the day, by when they were made.
static bool beforeInDay(JsonObjectConst a, JsonObjectConst b) {
  const bool aDone = a["done"] | false, bDone = b["done"] | false;
  if (aDone != bDone) return !aDone;
  const std::string aStart = str(a["start"]), bStart = str(b["start"]);
  if (aStart.empty() != bStart.empty()) return aStart.empty();
  if (!aStart.empty() && aStart != bStart) return aStart < bStart;
  const double aOrder = a["order"] | 0.0, bOrder = b["order"] | 0.0;
  if (aOrder != bOrder) return aOrder < bOrder;
  return (a["createdAt"] | 0.0) < (b["createdAt"] | 0.0);
}

static Task makeTask(JsonObjectConst item, JsonArrayConst categories) {
  Task task;
  task.id = str(item["id"]);
  task.title = str(item["title"]);
  task.date = str(item["date"]);
  task.focus = str(item["focus"]) == "must" ? "must" : "could";
  task.time = str(item["start"]);
  task.done = item["done"] | false;
  task.urgent = str(item["priority"]) == "urgent";
  task.repeat = str(item["repeat"]);
  task.duration = item["duration"] | 0;
  task.notes = str(item["notes"]);
  if (task.notes.size() > 1500) {
    size_t cut = 1500;
    while (cut > 0 && (static_cast<unsigned char>(task.notes[cut]) & 0xC0) == 0x80) cut--;  // whole UTF-8 letters
    task.notes = task.notes.substr(0, cut) + "…";
  }
  const std::string categoryId = str(item["category"]);
  if (!categoryId.empty()) {
    for (JsonObjectConst category : categories) {
      if (str(category["id"]) != categoryId) continue;
      task.category = str(category["name"]);
      task.color = str(category["color"]);
      break;
    }
  }
  return task;
}

Day buildDay(JsonArrayConst items, JsonArrayConst categories, JsonArrayConst agenda,
             const std::string& today, int nowMinutes, const MinutesOfDay& minutesOfDay) {
  Day day;
  day.date = today;

  std::vector<JsonObjectConst> list, late;
  for (JsonObjectConst item : items) {
    const std::string date = str(item["date"]);
    // planner.js overdueItems: a date before today and not done.
    if (!date.empty() && date < today && !(item["done"] | false)) {
      day.overdue++;
      if (!str(item["title"]).empty()) late.push_back(item);
      continue;
    }
    if (date != today || str(item["title"]).empty()) continue;
    const std::string focus = str(item["focus"]);
    if (focus == "later") continue;
    list.push_back(item);
  }
  std::stable_sort(list.begin(), list.end(), [](JsonObjectConst a, JsonObjectConst b) {
    const bool aMust = str(a["focus"]) == "must", bMust = str(b["focus"]) == "must";
    if (aMust != bMust) return aMust;
    return beforeInDay(a, b);
  });
  // Oldest first, as the app's Overdue list.
  std::stable_sort(late.begin(), late.end(), [](JsonObjectConst a, JsonObjectConst b) {
    const std::string aDate = str(a["date"]), bDate = str(b["date"]);
    if (aDate != bDate) return aDate < bDate;
    return beforeInDay(a, b);
  });

  for (JsonObjectConst item : list) {
    Task task = makeTask(item, categories);
    if (task.done) day.done++;
    day.tasks.push_back(task);
  }
  for (JsonObjectConst item : late) {
    if (day.late.size() >= MAX_LATE) break;
    day.late.push_back(makeTask(item, categories));
  }

  // The next thing on today's timeline that hasn't ended: a meeting or an
  // open task with a time (30 minutes when it has no length).
  struct Entry { bool meeting; std::string title; int start; int end; };
  std::vector<Entry> upcoming;
  for (JsonObjectConst event : agenda) {
    if (event["allDay"] | false) continue;
    const int64_t start = parseUtc(event["start"]);
    const int64_t end = parseUtc(event["end"]);
    if (start < 0 || end < 0) continue;
    const int startMin = minutesOfDay(start);
    const int endMin = std::max(minutesOfDay(end), startMin + 15);
    if (startMin >= 1440 || endMin <= nowMinutes) continue;
    upcoming.push_back({true, str(event["title"]), startMin, endMin});
  }
  for (JsonObjectConst item : list) {
    if (item["done"] | false) continue;
    const int start = timeToMinutes(str(item["start"]));
    if (start < 0) continue;
    const int length = item["duration"] | 0;
    const int end = start + (length > 0 ? length : 30);
    if (end <= nowMinutes) continue;
    upcoming.push_back({false, str(item["title"]), start, end});
  }
  std::stable_sort(upcoming.begin(), upcoming.end(), [](const Entry& a, const Entry& b) {
    return a.start != b.start ? a.start < b.start : a.end < b.end;
  });
  if (!upcoming.empty()) {
    const Entry& first = upcoming.front();
    day.next.has = true;
    day.next.meeting = first.meeting;
    day.next.title = first.title;
    day.next.start = minutesToTime(first.start);
    day.next.end = minutesToTime(first.end);
    day.next.now = first.start <= nowMinutes;
  }
  return day;
}

Light lightFor(const Day& day) {
  if (day.overdue > 0) return Light::Red;
  for (const Task& task : day.tasks) {
    if (task.urgent && !task.done) return Light::Amber;
  }
  return Light::Green;
}

// ---------- ticking ----------
static double nextOrder(JsonArrayConst items, const std::string& date) {
  bool any = false;
  double highest = 0;
  for (JsonObjectConst item : items) {
    if (str(item["date"]) != date) continue;
    const double order = item["order"] | 0.0;
    if (!any || order > highest) highest = order;
    any = true;
  }
  return any ? highest + 10 : 0;
}

bool toggleItem(JsonArray items, const std::string& id, const std::string& today, int64_t nowMs, const std::string& newId) {
  JsonObject item;
  for (JsonObject candidate : items) {
    if (str(candidate["id"]) == id) { item = candidate; break; }
  }
  if (item.isNull()) return false;

  if (item["done"] | false) {
    // Unticking takes back the next occurrence it made, if still untouched.
    const std::string spawned = str(item["spawned"]);
    if (!spawned.empty()) {
      for (size_t index = 0; index < items.size(); index++) {
        JsonObject other = items[index];
        if (str(other["id"]) == spawned && !(other["done"] | false)) { items.remove(index); break; }
      }
    }
    item["done"] = false;
    item["doneAt"] = nullptr;
    item["spawned"] = nullptr;
    return true;
  }

  const std::string date = str(item["date"]);
  const std::string repeat = str(item["repeat"]);
  if (!repeat.empty() && !date.empty()) {
    const std::string anchor = str(item["repeatAnchor"]).empty() ? date : str(item["repeatAnchor"]);
    const std::string nextDate = nextUpcoming(repeat, date, anchor, today);
    if (!nextDate.empty()) {
      const double order = nextOrder(items, nextDate);
      JsonObject next = items.add<JsonObject>();
      next.set(item);
      next["id"] = newId;
      next["date"] = nextDate;
      next["done"] = false;
      next["doneAt"] = nullptr;
      next["spawned"] = nullptr;
      next["createdAt"] = nowMs;
      next["order"] = order;
      item["spawned"] = newId;
    }
  }
  item["done"] = true;
  item["doneAt"] = nowMs;
  if (date.empty()) item["date"] = today;
  return true;
}

}  // namespace planner
