const test = require("node:test");
const assert = require("node:assert/strict");
const { toISODate } = require("../core.js");
const P = require("../planner.js");

// Tuesday, 20 Oct 2026, 14:30 local time
const NOW = new Date(2026, 9, 20, 14, 30);

test("weeks start on the configured weekday", () => {
  assert.equal(toISODate(P.startOfWeek(NOW, 1)), "2026-10-19");
  assert.equal(toISODate(P.startOfWeek(NOW, 0)), "2026-10-18");
  // A Sunday belongs to the week that started the previous Monday.
  assert.equal(toISODate(P.startOfWeek(new Date(2026, 9, 25), 1)), "2026-10-19");
  const days = P.weekDays(NOW, 1).map(toISODate);
  assert.deepEqual(days, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
});

test("ISO week numbers", () => {
  assert.equal(P.isoWeekNumber(NOW), 43);
  assert.equal(P.isoWeekNumber(new Date(2026, 0, 1)), 1);
  assert.equal(P.isoWeekNumber(new Date(2027, 0, 1)), 53);
});

test("time helpers validate and convert", () => {
  assert.equal(P.isTime("09:30"), true);
  assert.equal(P.isTime("24:00"), false);
  assert.equal(P.timeToMinutes("09:30"), 570);
  assert.equal(P.minutesToTime(570), "09:30");
  assert.equal(P.minutesToTime(2000), "23:59");
});

test("normalizeItem drops time data that cannot apply", () => {
  const item = P.normalizeItem({ title: "  Call  ", date: null, start: "09:00", duration: 30 }, 1);
  assert.equal(item.title, "Call");
  assert.equal(item.start, null);
  assert.equal(item.duration, null);
  assert.equal(P.normalizeItem({ title: "x", date: "2026-02-30" }).date, null);
  const timed = P.normalizeItem({ title: "x", date: "2026-10-20", start: "09:00", duration: 45 });
  assert.equal(timed.start, "09:00");
  assert.equal(timed.duration, 45);
});

test("days list untimed tasks first, then timed items by start", () => {
  const items = [
    P.normalizeItem({ id: "b", title: "b", date: "2026-10-20", start: "14:00" }),
    P.normalizeItem({ id: "a", title: "a", date: "2026-10-20", order: 10 }),
    P.normalizeItem({ id: "c", title: "c", date: "2026-10-20", start: "09:00" }),
    P.normalizeItem({ id: "d", title: "d", date: "2026-10-20", order: 0 }),
    P.normalizeItem({ id: "e", title: "e", date: "2026-10-21" }),
  ];
  assert.deepEqual(P.itemsForDay(items, "2026-10-20").map((item) => item.id), ["d", "a", "c", "b"]);
});

test("createItem appends to the end of its bucket", () => {
  const items = [P.normalizeItem({ id: "a", title: "a", date: "2026-10-20", order: 30 })];
  assert.equal(P.createItem(items, { title: "b", date: "2026-10-20" }).order, 40);
  assert.equal(P.createItem(items, { title: "c" }).order, 0);
});

test("moveItem reschedules and reorders the target day", () => {
  const items = [
    P.normalizeItem({ id: "a", title: "a", date: "2026-10-20", order: 0 }),
    P.normalizeItem({ id: "b", title: "b", date: "2026-10-20", order: 10 }),
    P.normalizeItem({ id: "x", title: "x", date: null, order: 0 }),
  ];
  const moved = P.moveItem(items, "x", { date: "2026-10-20", beforeId: "b" });
  assert.deepEqual(P.itemsForDay(moved, "2026-10-20").map((item) => item.id), ["a", "x", "b"]);
  assert.equal(P.inboxItems(moved).length, 0);
  // Original array is not mutated.
  assert.equal(items[2].date, null);
});

test("moving back to the inbox clears time and completion", () => {
  const items = [P.normalizeItem({ id: "a", title: "a", date: "2026-10-20", start: "10:00", duration: 30, done: true, doneAt: 5 })];
  const [item] = P.moveItem(items, "a", { date: null });
  assert.deepEqual([item.date, item.start, item.duration, item.done], [null, null, null, false]);
});

test("completing an unscheduled item puts it on today", () => {
  const item = P.normalizeItem({ title: "a" });
  const done = P.toggleDone(item, "2026-10-20", 99);
  assert.equal(done.done, true);
  assert.equal(done.date, "2026-10-20");
  assert.equal(P.toggleDone(done, "2026-10-20").done, false);
});

test("overdue lists past, unfinished items oldest first", () => {
  const items = [
    P.normalizeItem({ id: "old", title: "a", date: "2026-10-01" }),
    P.normalizeItem({ id: "older", title: "b", date: "2026-09-30" }),
    P.normalizeItem({ id: "done", title: "c", date: "2026-10-01", done: true }),
    P.normalizeItem({ id: "today", title: "d", date: "2026-10-20" }),
  ];
  assert.deepEqual(P.overdueItems(items, "2026-10-20").map((item) => item.id), ["older", "old"]);
});

test("parseCapture understands time, date, urgency and category", () => {
  assert.deepEqual(P.parseCapture("Dentist @tomorrow 14:30 #Health !urgent", NOW), {
    title: "Dentist",
    date: "2026-10-21",
    start: "14:30",
    priority: "urgent",
    category: "HEALTH",
  });
  assert.equal(P.parseCapture("Gym 7h", NOW).start, "07:00");
  assert.equal(P.parseCapture("Standup 9h30", NOW).start, "09:30");
  assert.equal(P.parseCapture("Buy 3 apples", NOW).start, null);
  assert.equal(P.parseCapture("Room 27h", NOW).start, null);
});

test("migrateLegacy converts 1.x tasks and categories", () => {
  const { items, categories } = P.migrateLegacy({
    todos: [
      { id: "1", title: "Report", dueDate: "2026-10-20", priority: "boss", category: "WORK", order: -200, createdAt: 200 },
      { id: "2", title: "Gym", dueDate: "2026-10-20", priority: "normal", category: null, order: -100, createdAt: 100 },
      { id: "3", title: "   ", dueDate: null },
      { id: "4", title: "Someday", dueDate: null, done: true, createdAt: 50 },
    ],
    categories: ["WORK", "HOME"],
    categoryColors: { WORK: "#c9dfd5" },
  });
  assert.deepEqual(categories, [
    { id: "work", name: "Work", color: "#c9dfd5" },
    { id: "home", name: "Home", color: P.PALETTE[1] },
  ]);
  assert.equal(items.length, 3);
  const report = items.find((item) => item.id === "1");
  assert.deepEqual([report.priority, report.category, report.date, report.order], ["urgent", "work", "2026-10-20", 0]);
  assert.equal(items.find((item) => item.id === "2").order, 10);
});

test("ISO week keys follow the ISO week-year", () => {
  assert.equal(P.isoWeekKey(NOW), "2026-W43");
  assert.equal(P.isoWeekKey(new Date(2027, 0, 1)), "2026-W53");
  assert.equal(P.isoWeekKey(new Date(2026, 11, 31)), "2026-W53");
  assert.equal(P.isoWeekKey(new Date(2025, 11, 29)), "2026-W01");
});

test("moon phase matches known 2026 new and full moons", () => {
  assert.equal(P.moonPhaseName(P.moonPhase(new Date(2026, 9, 10))), "new");
  assert.equal(P.moonPhaseName(P.moonPhase(new Date(2026, 9, 26))), "full");
  assert.equal(P.moonPhaseName(P.moonPhase(new Date(2026, 0, 3))), "full");
  assert.equal(P.moonPhaseName(P.moonPhase(new Date(2026, 1, 17))), "new");
  const phase = P.moonPhase(NOW);
  assert.ok(phase >= 0 && phase < 1);
});

test("moon path draws a crescent, a half and a full disc", () => {
  assert.match(P.moonLitPath(0.25), /A0 5/);
  // Full moon: left half arc, then the terminator sweeps back over the right half.
  assert.equal(P.moonLitPath(0.5), "M6 1A5 5 0 0 0 6 11A5 5 0 0 0 6 1Z");
  assert.ok(P.moonLitPath(0.1).startsWith("M6 1A5 5 0 0 1 6 11"));
  assert.ok(P.moonLitPath(0.9).startsWith("M6 1A5 5 0 0 0 6 11"));
});

test("Easter and the Brazilian holidays derived from it", () => {
  assert.equal(toISODate(P.easterSunday(2026)), "2026-04-05");
  assert.equal(toISODate(P.easterSunday(2027)), "2027-03-28");
  const holidays = P.brazilHolidays(2026);
  assert.equal(holidays.get("2026-02-16"), "carnival");
  assert.equal(holidays.get("2026-02-17"), "carnival");
  assert.equal(holidays.get("2026-04-03"), "goodFriday");
  assert.equal(holidays.get("2026-06-04"), "corpusChristi");
  assert.equal(holidays.get("2026-11-20"), "blackConsciousness");
  assert.equal(P.holidayName("2026-11-02", "pt"), "Finados");
  assert.equal(P.holidayName("2026-10-12", "en"), "Our Lady of Aparecida");
  assert.equal(P.holidayName("2026-10-20", "pt"), null);
  assert.equal(P.brazilHolidays(2023).has("2023-11-20"), false);
});

test("weekly proverb cycles through the list", () => {
  assert.equal(P.proverbForWeek(1), P.PROVERBS[0]);
  assert.equal(P.proverbForWeek(P.PROVERBS.length + 1), P.PROVERBS[0]);
  assert.ok(P.proverbForWeek(43).jp);
});

test("day of year and leap years", () => {
  assert.equal(P.dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(P.dayOfYear(NOW), 293);
  assert.equal(P.dayOfYear(new Date(2026, 11, 31)), 365);
  assert.equal(P.daysInYear(2026), 365);
  assert.equal(P.daysInYear(2028), 366);
});

test("monthGrid covers the whole month in full weeks", () => {
  const october = P.monthGrid(2026, 9, 1);
  assert.equal(october.length, 5);
  assert.equal(toISODate(october[0][0]), "2026-09-28");
  assert.equal(toISODate(october[4][6]), "2026-11-01");
  const sundayStart = P.monthGrid(2026, 9, 0);
  assert.equal(toISODate(sundayStart[0][0]), "2026-09-27");
  assert.ok(P.monthGrid(2026, 7, 1).length === 6); // August 2026 spans six Monday-start weeks
});

test("scheduleAt sets date and time, keeping or defaulting the duration", () => {
  const items = [
    P.normalizeItem({ id: "a", title: "a", date: null }),
    P.normalizeItem({ id: "b", title: "b", date: "2026-10-20", start: "08:00", duration: 30 }),
  ];
  const [a] = P.scheduleAt(items, "a", { date: "2026-10-21", start: "14:15" });
  assert.deepEqual([a.date, a.start, a.duration], ["2026-10-21", "14:15", 60]);
  const b = P.scheduleAt(items, "b", { date: "2026-10-20", start: "09:00" })[1];
  assert.deepEqual([b.start, b.duration], ["09:00", 30]);
  assert.equal(P.scheduleAt(items, "a", { date: "2026-10-21", start: "25:00" }), items);
});

test("layoutTimeline puts overlapping items side by side", () => {
  const at = (id, start, duration) => P.normalizeItem({ id, title: id, date: "2026-10-20", start, duration });
  const layout = P.layoutTimeline([
    at("standup", "09:00", 30),
    at("review", "09:15", 60),
    at("lunch", "12:00", 60),
    at("call", "09:45", 30),
    P.normalizeItem({ id: "untimed", title: "x", date: "2026-10-20" }),
  ]);
  const byId = Object.fromEntries(layout.map((event) => [event.item.id, event]));
  assert.equal(layout.length, 4);
  assert.deepEqual([byId.standup.lane, byId.review.lane, byId.call.lane], [0, 1, 0]);
  assert.equal(byId.standup.lanes, 2);
  assert.equal(byId.lunch.lanes, 1);
  assert.deepEqual([byId.review.start, byId.review.end], [555, 615]);
});

test("default categories are localized but keep stable ids", () => {
  assert.deepEqual(P.defaultCategories("pt").map((category) => category.id), ["work", "personal", "health", "study"]);
  assert.equal(P.defaultCategories("pt")[2].name, "Saúde");
});
