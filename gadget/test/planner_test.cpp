// The screen's day logic, checked on the computer against what the app's
// planner.js does (the expected values come from it).
//
//   gadget/test/run.sh

#include <cassert>
#include <cstdio>
#include <string>

#include "../src/planner.h"

using namespace planner;

static int checks = 0;
#define CHECK(cond) do { checks++; if (!(cond)) { std::printf("FAILED line %d: %s\n", __LINE__, #cond); return 1; } } while (0)

static int dates() {
  CHECK(weekday("2026-11-13") == 5);  // Friday
  CHECK(weekday("1970-01-01") == 4);
  CHECK(addDays("2026-12-31", 1) == "2027-01-01");
  CHECK(addDays("2028-03-01", -1) == "2028-02-29");
  CHECK(nextOccurrence("daily", "2026-11-13", "2026-11-13") == "2026-11-14");
  CHECK(nextOccurrence("weekdays", "2026-11-13", "2026-11-13") == "2026-11-16");
  CHECK(nextOccurrence("weekly", "2026-11-13", "2026-11-13") == "2026-11-20");
  CHECK(nextOccurrence("biweekly", "2026-12-25", "2026-12-25") == "2027-01-08");
  CHECK(nextOccurrence("monthly", "2026-01-31", "2026-01-31") == "2026-02-28");
  CHECK(nextOccurrence("monthly", "2026-02-28", "2026-01-31") == "2026-03-31");
  CHECK(nextOccurrence("monthly", "2026-12-15", "2026-12-15") == "2027-01-15");
  CHECK(nextOccurrence("yearly", "2028-02-29", "2028-02-29") == "2029-02-28");
  CHECK(nextOccurrence("yearly", "2029-02-28", "2028-02-29") == "2030-02-28");
  CHECK(nextOccurrence("hourly", "2026-11-13", "2026-11-13").empty());
  CHECK(parseUtc("1970-01-02T00:00:00.000Z") == 86400);
  CHECK(parseUtc("2026-11-13T13:00:00.000Z") == 1794574800);
  CHECK(parseUtc("2026-11-13") == -1);
  return 0;
}

static const char* ITEMS = R"([
  {"id":"c1","title":"Could","date":"2026-11-13","focus":"could","order":0,"createdAt":1,"done":false},
  {"id":"m1","title":"Must","date":"2026-11-13","focus":"must","order":1,"createdAt":1,"done":false,"priority":"urgent","category":"k1","notes":"Ligar antes das 10h","repeat":"weekly"},
  {"id":"d1","title":"Done","date":"2026-11-13","focus":"must","order":2,"createdAt":1,"done":true},
  {"id":"l1","title":"Later","date":"2026-11-13","focus":"later","order":3,"createdAt":1,"done":false},
  {"id":"x1","title":"Other day","date":"2026-11-14","focus":"must","order":0,"createdAt":1,"done":false},
  {"id":"t1","title":"Gym","date":"2026-11-13","focus":"could","start":"18:00","duration":60,"order":4,"createdAt":1,"done":false},
  {"id":"t0","title":"Past","date":"2026-11-13","focus":"could","start":"08:00","duration":30,"order":5,"createdAt":1,"done":false}
])";

static const char* CATEGORIES = R"([{"id":"k1","name":"Trabalho","color":"#34508a"}])";

// Standup 14:00–15:00 local time, written as UTC like the app does (UTC-3).
static const char* AGENDA = R"({"events":[
  {"title":"Standup","start":"2026-11-13T17:00:00.000Z","end":"2026-11-13T18:00:00.000Z","allDay":false},
  {"title":"Feriado","start":"2026-11-13","end":"2026-11-14","allDay":true}
]})";

// Overdue: open tasks dated before today, whatever their group; done ones
// and undated ones don't count, as in the app's Overdue list.
static int overdue() {
  JsonDocument items, none;
  deserializeJson(items, R"([
    {"id":"o1","title":"Old","date":"2026-11-10","focus":"later","done":false},
    {"id":"o2","title":"Old done","date":"2026-11-11","focus":"must","done":true},
    {"id":"o3","title":"Loose","date":null,"done":false},
    {"id":"t1","title":"Today","date":"2026-11-13","focus":"could","done":false}
  ])");
  MinutesOfDay minutes = [](int64_t) { return 0; };
  Day day = buildDay(items.as<JsonArrayConst>(), none.as<JsonArrayConst>(), none.as<JsonArrayConst>(),
                     "2026-11-13", 600, minutes);
  CHECK(day.overdue == 1);
  CHECK(lightFor(day) == Light::Red);
  return 0;
}

static int day() {
  JsonDocument items, categories, agenda;
  deserializeJson(items, ITEMS);
  deserializeJson(categories, CATEGORIES);
  deserializeJson(agenda, AGENDA);
  const int64_t midnight = parseUtc("2026-11-13T03:00:00.000Z");  // local midnight at UTC-3
  MinutesOfDay minutes = [midnight](int64_t epoch) { return static_cast<int>((epoch - midnight) / 60); };

  Day at1430 = buildDay(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>(), agenda["events"].as<JsonArrayConst>(),
                        "2026-11-13", 14 * 60 + 30, minutes);
  std::string order;
  for (const Task& task : at1430.tasks) order += task.id + " ";
  CHECK(order == "m1 d1 c1 t0 t1 ");
  CHECK(at1430.done == 1);
  CHECK(at1430.tasks[0].urgent);
  CHECK(at1430.tasks[0].category == "Trabalho");
  CHECK(at1430.tasks[0].color == "#34508a");
  CHECK(at1430.tasks[4].time == "18:00");
  CHECK(at1430.tasks[4].duration == 60);
  CHECK(at1430.tasks[0].notes == "Ligar antes das 10h");
  CHECK(at1430.tasks[0].repeat == "weekly");
  CHECK(at1430.next.has && at1430.next.meeting && at1430.next.now);
  CHECK(at1430.next.title == "Standup" && at1430.next.start == "14:00" && at1430.next.end == "15:00");

  Day evening = buildDay(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>(), agenda["events"].as<JsonArrayConst>(),
                         "2026-11-13", 16 * 60, minutes);
  CHECK(evening.next.has && !evening.next.meeting && !evening.next.now);
  CHECK(evening.next.title == "Gym" && evening.next.start == "18:00" && evening.next.end == "19:00");

  // Light: an urgent task open today → amber; nothing overdue yet.
  CHECK(at1430.overdue == 0);
  CHECK(lightFor(at1430) == Light::Amber);
  Day ticked = at1430;
  ticked.tasks[0].done = true;  // the urgent one
  CHECK(lightFor(ticked) == Light::Green);

  Day night = buildDay(items.as<JsonArrayConst>(), categories.as<JsonArrayConst>(), agenda["events"].as<JsonArrayConst>(),
                       "2026-11-13", 20 * 60, minutes);
  CHECK(!night.next.has);
  return 0;
}

// Planner.completeItem on a weekly task finished late, then unticked.
static int ticking() {
  JsonDocument doc;
  deserializeJson(doc, R"([
    {"id":"a","title":"Gym","date":"2026-11-10","focus":"must","repeat":"weekly","repeatAnchor":"2026-11-10","order":5,"createdAt":1,"done":false,"doneAt":null,"spawned":null,"notes":"keep me"},
    {"id":"b","title":"x","date":"2026-11-17","focus":"could","order":30,"createdAt":1,"done":false}
  ])");
  JsonArray items = doc.as<JsonArray>();
  CHECK(toggleItem(items, "a", "2026-11-13", 1000, "NEW"));
  CHECK(items.size() == 3);
  CHECK(items[0]["done"] == true && items[0]["doneAt"] == 1000 && items[0]["spawned"] == "NEW");
  CHECK(items[0]["date"] == "2026-11-10");
  CHECK(items[2]["id"] == "NEW" && items[2]["date"] == "2026-11-17" && items[2]["order"] == 40);
  CHECK(items[2]["done"] == false && items[2]["doneAt"].isNull() && items[2]["createdAt"] == 1000);
  CHECK(items[2]["notes"] == "keep me" && items[2]["repeat"] == "weekly");

  CHECK(toggleItem(items, "a", "2026-11-13", 2000, "UNUSED"));
  CHECK(items.size() == 2);
  CHECK(items[0]["done"] == false && items[0]["spawned"].isNull() && items[0]["doneAt"].isNull());

  // A plain task with no date lands on today when ticked.
  JsonDocument plain;
  deserializeJson(plain, R"([{"id":"p","title":"Loose","date":null,"done":false}])");
  CHECK(toggleItem(plain.as<JsonArray>(), "p", "2026-11-13", 5, "N"));
  CHECK(plain[0]["date"] == "2026-11-13" && plain[0]["done"] == true);
  CHECK(!toggleItem(plain.as<JsonArray>(), "missing", "2026-11-13", 5, "N"));
  return 0;
}

int main() {
  if (dates() || day() || overdue() || ticking()) return 1;
  std::printf("planner: %d checks passed\n", checks);
  return 0;
}
