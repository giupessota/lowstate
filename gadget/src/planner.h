// The day as the desk screen shows it, worked out from Lowstate's own data
// the same way the app does (planner.js): which tasks belong to today, their
// order, the next thing on the timeline, and what ticking a task does —
// including a repeating task's next occurrence.
//
// Plain C++ and ArduinoJson only, so it also builds and is tested on the
// computer (gadget/test/planner_test.cpp).
#pragma once

#include <ArduinoJson.h>

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace planner {

extern const char* const ITEMS_KEY;
extern const char* const CATEGORIES_KEY;

// ---------- dates (YYYY-MM-DD, local calendar days) ----------
bool parseIso(const std::string& iso, int& y, int& m, int& d);
std::string isoDate(int y, int m, int d);
std::string addDays(const std::string& iso, int days);
int weekday(const std::string& iso);  // 0 = Sunday
std::string nextOccurrence(const std::string& repeat, const std::string& iso, const std::string& anchor);
std::string nextUpcoming(const std::string& repeat, const std::string& date, const std::string& anchor, const std::string& today);
// "2026-11-13T13:00:00.000Z" → seconds since 1970 (UTC); -1 when not one.
int64_t parseUtc(const char* text);

// ---------- the day ----------
struct Task {
  std::string id;
  std::string title;
  std::string date;      // YYYY-MM-DD (shown for overdue tasks)
  std::string focus;     // "must" | "could"
  std::string time;      // "HH:MM" or ""
  std::string category;  // name, or ""
  std::string color;     // "#rrggbb", or ""
  std::string notes;     // the task's description (cut at 1500 bytes)
  std::string repeat;    // "daily" | "weekdays" | "weekly" | … or ""
  int duration = 0;      // minutes, 0 when not set
  bool done = false;
  bool urgent = false;
};

struct Next {
  bool has = false;
  bool now = false;
  bool meeting = false;
  std::string title;
  std::string start;  // "HH:MM"
  std::string end;
};

struct Day {
  std::string date;
  std::vector<Task> tasks;  // Must do first, then Could do; open before done
  Next next;
  int done = 0;
  int overdue = 0;          // open tasks from earlier days (the app's "Overdue" list)
  std::vector<Task> late;   // those tasks, oldest first (at most MAX_LATE)
};

const size_t MAX_LATE = 12;

// The status light behind the screen: red when something is overdue, amber
// when an urgent task of today is still open, green when the day is on track.
enum class Light { Green, Amber, Red };
Light lightFor(const Day& day);

// Minutes from today's local midnight for a UTC instant (negative before
// today, over 1440 after it).
using MinutesOfDay = std::function<int(int64_t epochSeconds)>;

Day buildDay(JsonArrayConst items, JsonArrayConst categories, JsonArrayConst agenda,
             const std::string& today, int nowMinutes, const MinutesOfDay& minutesOfDay);

// Ticks or unticks a task, like the app (Planner.completeItem). `newId` is
// used when a repeating task makes its next occurrence. False if not found.
bool toggleItem(JsonArray items, const std::string& id, const std::string& today, int64_t nowMs,
                const std::string& newId);

}  // namespace planner
