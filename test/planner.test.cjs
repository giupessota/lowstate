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

test("mental load estimate grows with must-dos, busy hours, overdue and heavy days", () => {
  const day = "2026-10-21";
  const item = (fields) => P.normalizeItem({ title: "t", date: day, ...fields });
  assert.equal(P.mentalLoad([], day).score, 0);
  const busy = [
    item({ focus: "must" }), item({ focus: "must" }), item({ focus: "must", priority: "urgent" }),
    item({ start: "09:00", duration: 120 }), item({ start: "14:00", duration: 120 }),
    item({ focus: "later" }), item({ focus: "must", done: true }),
    P.normalizeItem({ title: "old", date: "2026-10-19" }),
  ];
  const load = P.mentalLoad(busy, day, { todayISO: day, moods: { "2026-10-20": "stressed" } });
  assert.deepEqual(load.factors, { must: 3, could: 2, urgent: 1, hours: 4, meetings: 0, calls: 0, backToBack: 0, overdue: 1, heavyDays: 1 });
  assert.equal(load.score, 8);
  assert.equal(P.mentalLoad(busy, day, { todayISO: "2026-10-20" }).factors.overdue, 0);
  assert.equal(P.loadLevel(2), "light");
  assert.equal(P.loadLevel(7), "heavy");
  assert.equal(P.loadLevel(10), "veryHeavy");
});

test("cover picker converts between hex and hue/saturation/value", () => {
  assert.deepEqual(P.hexToHsv("#ff0000"), { h: 0, s: 1, v: 1 });
  assert.deepEqual(P.hexToHsv("#000000"), { h: 0, s: 0, v: 0 });
  assert.equal(P.hsvToHex(120, 1, 1), "#00ff00");
  assert.equal(P.hsvToHex(0, 0, 1), "#ffffff");
  ["#2b3d63", "#7a2e8c", "#d64a32", "#3e9aa8"].forEach((hex) => {
    const { h, s, v } = P.hexToHsv(hex);
    const back = P.hsvToHex(h, s, v);
    const diff = [1, 3, 5].map((i) => Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)));
    assert.ok(Math.max(...diff) <= 2, `${hex} -> ${back}`);
  });
  assert.equal(P.hexToHsv("nope"), null);
});

test("custom cover colors are darkened only as much as the light text needs", () => {
  assert.equal(P.readableCover("#2b3d63"), "#2b3d63");
  assert.equal(P.readableCover("2B3D63"), "#2b3d63");
  const yellow = P.readableCover("#ffe066");
  assert.notEqual(yellow, "#ffe066");
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  assert.ok(lum(yellow) <= 0.139);
  assert.equal(P.readableCover("#ffffff").length, 7);
  assert.equal(P.readableCover("blue"), null);
});

test("habits: toggling, streaks that survive an unchecked today, monthly progress", () => {
  assert.deepEqual(P.normalizeHabits([{ id: "a", name: " Ler " }, { id: "a", name: "dup" }, { id: "b", name: "" }, null]), [
    { id: "a", name: "Ler", color: P.PALETTE[0], icon: null, days: [], start: null, duration: null, times: {}, since: null, until: null },
  ]);
  let log = {};
  ["2026-10-18", "2026-10-19", "2026-10-20"].forEach((iso) => { log = P.toggleHabit(log, iso, "read"); });
  log = P.toggleHabit(log, "2026-10-20", "walk");
  assert.equal(P.habitStreak(log, "read", "2026-10-21"), 3);
  log = P.toggleHabit(log, "2026-10-21", "read");
  assert.equal(P.habitStreak(log, "read", "2026-10-21"), 4);
  assert.equal(P.habitStreak(log, "walk", "2026-10-22"), 0);
  log = P.toggleHabit(log, "2026-10-21", "read");
  assert.deepEqual(log["2026-10-21"], undefined);
  assert.deepEqual(P.habitMonth(log, "read", 2026, 9, "2026-10-21"), { done: 3, little: 0, rest: 0, extra: 0, elapsed: 21, total: 31, score: 3 });
  assert.deepEqual(P.habitMonth(log, "read", 2026, 8, "2026-10-21"), { done: 0, little: 0, rest: 0, extra: 0, elapsed: 30, total: 30, score: 0 });
  assert.deepEqual(P.forgetHabit(log, "walk")["2026-10-20"], { read: "done" });
  assert.equal(P.habitDone(P.forgetHabit(log, "read"), "2026-10-18", "read"), false);
});

test("gentle habits: a little counts half, rest days are neither missed nor counted", () => {
  // Older logs ({ iso: [ids] }) read as done.
  assert.deepEqual(P.normalizeHabitLog({ "2026-10-20": ["gym", 3], "2026-10-19": { gym: "little", x: "nope" }, bad: ["gym"] }),
    { "2026-10-20": { gym: "done" }, "2026-10-19": { gym: "little" } });
  assert.equal(P.habitState({ "2026-10-20": ["gym"] }, "2026-10-20", "gym"), "done");
  const [gym] = P.normalizeHabits([{ id: "gym", name: "Academia", days: [1, 3, 5], since: "2026-10-01" }]);
  let log = {};
  log = P.setHabitState(log, "2026-10-19", "gym", "done");   // Mon
  log = P.setHabitState(log, "2026-10-16", "gym", "rest");   // Fri — on purpose
  log = P.setHabitState(log, "2026-10-14", "gym", "little"); // Wed
  log = P.setHabitState(log, "2026-10-12", "gym", "done");   // Mon
  assert.equal(P.habitDone(log, "2026-10-14", "gym"), true);
  assert.equal(P.habitDone(log, "2026-10-16", "gym"), false);
  // Rest doesn't break the streak and isn't counted in it.
  assert.equal(P.habitStreak(log, gym, "2026-10-20"), 3);
  // Oct 1–20 planned: 2,5,7,9,12,14,16,19 → 8; one rest → 7 counted; score 1 + 0.5 + 1.
  assert.deepEqual(P.habitMonth(log, gym, 2026, 9, "2026-10-20"), { done: 3, little: 1, rest: 1, extra: 0, elapsed: 7, total: 13, score: 2.5 });
  // Clearing and toggling.
  assert.equal(P.habitState(P.setHabitState(log, "2026-10-14", "gym", null), "2026-10-14", "gym"), null);
  assert.equal(P.habitState(P.toggleHabit(log, "2026-10-16", "gym"), "2026-10-16", "gym"), null);
  assert.equal(P.habitState(P.toggleHabit({}, "2026-10-16", "gym"), "2026-10-16", "gym"), "done");
});

test("habits planned for some weekdays: icons, schedule, streaks and month counts", () => {
  const [gym] = P.normalizeHabits([{ id: "gym", name: "Academia", icon: "dumbbell", days: [5, 1, 3, 3, 9] }]);
  assert.deepEqual([gym.icon, gym.days, gym.start], ["dumbbell", [1, 3, 5], null]);
  const [timed] = P.normalizeHabits([{ id: "t", name: "Academia", start: "07:00", duration: 75 }]);
  assert.deepEqual([timed.start, timed.duration], ["07:00", 75]);
  assert.deepEqual(P.normalizeHabits([{ id: "t", name: "x", start: "25:00", duration: 60 }])[0].duration, null);
  // Different times per weekday: Mon/Wed 07:00, Fri 18:00 for 90 minutes; Sunday has no time.
  const [split] = P.normalizeHabits([{ id: "s", name: "Academia", days: [0, 1, 3, 5],
    times: { 1: { start: "07:00" }, 3: { start: "07:00", duration: 60 }, 5: { start: "18:00", duration: 90 }, 9: { start: "08:00" }, 0: { start: "nope" } } }]);
  assert.deepEqual(split.times, { 1: { start: "07:00", duration: 60 }, 3: { start: "07:00", duration: 60 }, 5: { start: "18:00", duration: 90 } });
  assert.deepEqual(P.habitTimeOn(split, "2026-10-19"), { start: "07:00", duration: 60 });
  assert.deepEqual(P.habitTimeOn(split, "2026-10-23"), { start: "18:00", duration: 90 });
  assert.equal(P.habitTimeOn(split, "2026-10-25"), null);
  assert.equal(P.habitTimeOn(split, "2026-10-22"), null);
  assert.deepEqual(P.habitTimeOn(timed, "2026-10-22"), { start: "07:00", duration: 75 });

  // The editor's rows: days that share a time are one row.
  assert.deepEqual(P.scheduleRows(split), [
    { days: [0], start: null, duration: 60 },
    { days: [1, 3], start: "07:00", duration: 60 },
    { days: [5], start: "18:00", duration: 90 },
  ]);
  assert.deepEqual(P.scheduleRows(timed), [{ days: [], start: "07:00", duration: 75 }]);
  assert.deepEqual(P.habitFromRows([{ days: [3, 1], start: "07:00", duration: 60 }, { days: [5], start: "18:00", duration: 90 }]), {
    days: [1, 3, 5], start: null, duration: null,
    times: { 1: { start: "07:00", duration: 60 }, 3: { start: "07:00", duration: 60 }, 5: { start: "18:00", duration: 90 } },
  });
  assert.deepEqual(P.habitFromRows([{ days: [1, 3, 5], start: "07:00", duration: 45 }, { days: [], start: "09:00", duration: 60 }]),
    { days: [1, 3, 5], start: "07:00", duration: 45, times: {} });
  assert.deepEqual(P.habitFromRows([{ days: [], start: null, duration: 60 }]), { days: [], start: null, duration: null, times: {} });
  // Round trip keeps the habit the same.
  assert.deepEqual(P.normalizeHabits([{ ...split, ...P.habitFromRows(P.scheduleRows(split)) }])[0], split);
  assert.deepEqual(P.normalizeHabits([{ id: "x", name: "x", icon: "rocket", days: [0, 1, 2, 3, 4, 5, 6] }])[0].icon, null);
  assert.deepEqual(P.normalizeHabits([{ id: "x", name: "x", days: [0, 1, 2, 3, 4, 5, 6] }])[0].days, []);
  // October 2026: the 19th is a Monday, the 21st a Wednesday, the 22nd a Thursday.
  assert.equal(P.habitScheduled(gym, "2026-10-21"), true);
  assert.equal(P.habitScheduled(gym, "2026-10-22"), false);
  let log = {};
  ["2026-10-16", "2026-10-19", "2026-10-21"].forEach((iso) => { log = P.toggleHabit(log, iso, "gym"); });
  // Unplanned Thursday today, unplanned Tuesday and weekend skipped, missed Wed 14th stops it.
  assert.equal(P.habitStreak(log, gym, "2026-10-22"), 3);
  log = P.toggleHabit(log, "2026-10-20", "gym");
  assert.equal(P.habitStreak(log, gym, "2026-10-22"), 4);
  assert.deepEqual(P.habitMonth(log, gym, 2026, 9, "2026-10-22"), { done: 3, little: 0, rest: 0, extra: 1, elapsed: 9, total: 13, score: 3 });
});

test("patterns need enough days on both sides and a clear difference", () => {
  const today = "2026-10-21";
  const back = (n) => { const d = new Date(2026, 9, 21 - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  // Three days of data say nothing.
  let moods = { [back(1)]: "great", [back(2)]: "rough", [back(3)]: "good" };
  let water = { [back(1)]: 8, [back(2)]: 2, [back(3)]: 8 };
  assert.deepEqual(P.patterns({ moods, water, waterTarget: 8, todayISO: today }).patterns, []);
  // Twelve days: good moods when the goal is met, low ones when it isn't.
  moods = {};
  water = {};
  for (let n = 1; n <= 12; n++) {
    const met = n % 2 === 0;
    moods[back(n)] = met ? "good" : "tiring";
    water[back(n)] = met ? 8 : 3;
  }
  const result = P.patterns({ moods, water, waterTarget: 8, todayISO: today });
  assert.equal(result.moodDays, 12);
  assert.equal(result.patterns.length, 1);
  assert.deepEqual(
    [result.patterns[0].kind, result.patterns[0].na, result.patterns[0].nb, result.patterns[0].diff],
    ["mood-water", 6, 6, 2]);
  // Same mood whatever the water: no pattern.
  const flat = Object.fromEntries(Object.keys(moods).map((iso) => [iso, "good"]));
  assert.deepEqual(P.patterns({ moods: flat, water, waterTarget: 8, todayISO: today }).patterns, []);
  // Reported load lower the day after a walk.
  const [walk] = P.normalizeHabits([{ id: "walk", name: "Caminhar", since: "2026-08-01" }]);
  let log = {};
  const loads = {};
  for (let n = 2; n <= 17; n++) {
    if (n % 2 === 0) log = P.toggleHabit(log, back(n), "walk");
    loads[back(n - 1)] = n % 2 === 0 ? 3 : 7;
  }
  const after = P.patterns({ habits: [walk], habitLog: log, loads, todayISO: today }).patterns;
  assert.equal(after[0].kind, "load-habit");
  assert.equal(after[0].habitId, "walk");
  assert.ok(after[0].a < after[0].b);
});

test("habit insight names the most reliable weekday, or says there isn't enough yet", () => {
  // Wednesday 21 October 2026; gym planned Mon/Wed/Fri since September.
  const [gym] = P.normalizeHabits([{ id: "g", name: "Academia", days: [1, 3, 5], since: "2026-09-01" }]);
  assert.deepEqual(P.habitInsight({}, gym, "2026-10-21"), { kind: "none" });
  let log = {};
  // Every Wednesday done, Mondays half, Fridays never (last three weeks).
  ["2026-10-07", "2026-10-14", "2026-09-30", "2026-10-12", "2026-09-28"].forEach((iso) => { log = P.toggleHabit(log, iso, "g"); });
  const insight = P.habitInsight(log, gym, "2026-10-21", 3);
  assert.equal(insight.kind, "best");
  assert.equal(insight.day, 3);
  assert.equal(insight.rate, 1);
  let all = {};
  ["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19"].forEach((iso) => { all = P.toggleHabit(all, iso, "g"); });
  assert.deepEqual(P.habitInsight(all, gym, "2026-10-21", 2), { kind: "perfect" });
});

test("habits only count between their start and end dates", () => {
  const [walk] = P.normalizeHabits([{ id: "w", name: "Caminhar", since: "2026-10-12", until: "2026-10-23" }]);
  assert.deepEqual(P.normalizeHabits([{ id: "x", name: "x", since: "2026-10-12", until: "2026-10-01" }])[0].until, null);
  assert.equal(P.habitScheduled(walk, "2026-10-11"), false);
  assert.equal(P.habitScheduled(walk, "2026-10-12"), true);
  assert.equal(P.habitScheduled(walk, "2026-10-24"), false);
  assert.equal(P.habitTimeOn({ ...walk, start: "07:00" }, "2026-10-30"), null);
  assert.equal(P.habitActiveBetween(walk, "2026-09-01", "2026-09-30"), false);
  assert.equal(P.habitActiveBetween(walk, "2026-10-01", "2026-10-31"), true);
  assert.equal(P.habitActiveBetween(walk, "2026-11-01", "2026-11-30"), false);
  // October 2026, today the 25th: planned from the 12th to the 23rd only.
  let log = {};
  ["2026-10-12", "2026-10-13", "2026-10-23"].forEach((iso) => { log = P.toggleHabit(log, iso, "w"); });
  assert.deepEqual(P.habitMonth(log, walk, 2026, 9, "2026-10-25"), { done: 3, little: 0, rest: 0, extra: 0, elapsed: 12, total: 12, score: 3 });
  const fresh = { ...walk, until: null };
  log = P.toggleHabit(P.toggleHabit({}, "2026-10-12", "w"), "2026-10-13", "w");
  assert.equal(P.habitStreak(log, fresh, "2026-10-13"), 2);
});

test("brain dump splits lines, drops bullets and blanks, and imports old notes", () => {
  assert.deepEqual(P.parseDump("comprar café\n\n- ligar pra mãe\n  • ideia: app de receitas \n1. revisar contrato #trabalho\n[ ] pagar boleto !urgente\n* 14h dentista"), [
    "comprar café", "ligar pra mãe", "ideia: app de receitas", "revisar contrato #trabalho", "pagar boleto !urgente", "14h dentista",
  ]);
  assert.deepEqual(P.parseDump("   \n  "), []);
  const notes = P.legacyDumpNotes([
    { id: "n1", text: "ideia solta", processed: false, createdAt: 5 },
    { id: "n2", text: "já virou tarefa", processed: true, createdAt: 6 },
    { id: "n3", text: "  ", processed: false },
  ]);
  assert.deepEqual(notes, [{ id: "n1", text: "ideia solta", createdAt: 5 }]);
});

test("search finds words anywhere, ignoring accents and case", () => {
  const sources = {
    items: [
      P.normalizeItem({ id: "a", title: "Dentista às 14h", date: "2026-10-20" }),
      P.normalizeItem({ id: "b", title: "Ligar", notes: "perguntar sobre o orçamento do dentista", date: "2026-09-01" }),
      P.normalizeItem({ id: "c", title: "Comprar café" }),
    ],
    habits: P.normalizeHabits([{ id: "h", name: "Café sem açúcar" }]),
    dump: [{ id: "d", text: "ideia: app de receitas com café", createdAt: new Date(2026, 9, 21).getTime() }],
    dayNotes: { "2026-10-18": "Dia longo. Café com a Ana." },
    closures: { "2026-10-19": { good: "Terminei o orçamento" } },
    moodNotes: { "2026-10-17": "reunião difícil" },
    weekNotes: { "2026-W43": "Semana do orçamento" },
  };
  assert.deepEqual(P.search(sources, "DENTISTA").map((r) => [r.kind, r.id]), [["task", "a"], ["task", "b"]]);
  assert.match(P.search(sources, "dentista")[1].snippet, /orçamento do dentista/);
  assert.deepEqual(P.search(sources, "cafe").map((r) => r.kind), ["task", "habit", "dump", "dayNote"]);
  assert.deepEqual(P.search(sources, "orcamento").map((r) => r.kind), ["task", "closure", "weekNote"]);
  assert.equal(P.search(sources, "orcamento").find((r) => r.kind === "weekNote").date, "2026-10-19");
  assert.deepEqual(P.search(sources, "cafe ana").map((r) => r.kind), ["dayNote"]);
  assert.deepEqual(P.search(sources, "   "), []);
  assert.equal(P.weekKeyToDate("2027-W01").getDate(), 4);
});

test("repeat rules find the next date, keeping the day of month", () => {
  assert.equal(P.nextOccurrence("daily", "2026-10-21"), "2026-10-22");
  assert.equal(P.nextOccurrence("weekly", "2026-10-21"), "2026-10-28");
  assert.equal(P.nextOccurrence("biweekly", "2026-10-21"), "2026-11-04");
  assert.equal(P.nextOccurrence("weekdays", "2026-10-23"), "2026-10-26"); // Fri → Mon
  assert.equal(P.nextOccurrence("monthly", "2026-01-31", "2026-01-31"), "2026-02-28");
  assert.equal(P.nextOccurrence("monthly", "2026-02-28", "2026-01-31"), "2026-03-31");
  assert.equal(P.nextOccurrence("monthly", "2026-12-05"), "2027-01-05");
  assert.equal(P.nextOccurrence("yearly", "2028-02-29", "2028-02-29"), "2029-02-28");
  assert.equal(P.nextOccurrence("nope", "2026-10-21"), null);
  assert.equal(P.normalizeItem({ title: "x", repeat: "monthly" }).repeat, null); // needs a date
  const rent = P.normalizeItem({ title: "Aluguel", date: "2026-10-05", repeat: "monthly" });
  assert.deepEqual([rent.repeat, rent.repeatAnchor], ["monthly", "2026-10-05"]);
});

test("completing a repeating task creates the next one; unticking takes it back", () => {
  const rent = P.normalizeItem({ id: "rent", title: "Pagar aluguel", date: "2026-10-05", repeat: "monthly", focus: "must" });
  // Paid late, on the 21st: the next is November 5th (not an overdue copy).
  let items = P.completeItem([rent], "rent", "2026-10-21", 1);
  assert.equal(items.length, 2);
  const next = items.find((item) => item.id !== "rent");
  assert.deepEqual([next.date, next.done, next.repeat, next.focus, next.title], ["2026-11-05", false, "monthly", "must", "Pagar aluguel"]);
  assert.equal(items.find((item) => item.id === "rent").spawned, next.id);
  items = P.completeItem(items, "rent", "2026-10-21");
  assert.deepEqual(items.map((item) => [item.id, item.done]), [["rent", false]]);
  // A daily task overdue for days jumps to today.
  const water = P.normalizeItem({ id: "w", title: "Regar plantas", date: "2026-10-15", repeat: "daily" });
  assert.equal(P.completeItem([water], "w", "2026-10-21").find((item) => item.id !== "w").date, "2026-10-21");
  // Plain tasks just toggle.
  assert.equal(P.completeItem([P.normalizeItem({ id: "p", title: "p", date: "2026-10-21" })], "p", "2026-10-21").length, 1);
  // Skipping moves the open task to its next date.
  assert.equal(P.skipOccurrence([rent], "rent", "2026-10-01")[0].date, "2026-11-05");
});

test("upcoming occurrences fill the calendar ahead, read-only", () => {
  const gym = P.normalizeItem({ id: "g", title: "Pilates", date: "2026-10-20", repeat: "weekly" });
  const ghosts = P.upcomingOccurrences([gym], "2026-10-01", "2026-11-30");
  assert.deepEqual(ghosts.map((ghost) => ghost.date), ["2026-10-27", "2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  assert.ok(ghosts.every((ghost) => ghost.ghost && ghost.sourceId === "g" && ghost.id.startsWith("g@")));
  assert.deepEqual(P.upcomingOccurrences([{ ...gym, done: true }], "2026-10-01", "2026-11-30"), []);
});

test("closing a day moves, returns or leaves its unfinished tasks", () => {
  const day = "2026-10-21";
  const items = [
    P.normalizeItem({ id: "a", title: "a", date: day, focus: "must" }),
    P.normalizeItem({ id: "b", title: "b", date: day, focus: "later" }),
    P.normalizeItem({ id: "c", title: "c", date: day, done: true }),
    P.normalizeItem({ id: "d", title: "d", date: day, start: "15:00", duration: 30 }),
    P.normalizeItem({ id: "e", title: "e", date: "2026-10-22" }),
  ];
  const moved = P.closeDay(items, day, "tomorrow", "2026-10-22");
  const byId = Object.fromEntries(moved.map((item) => [item.id, item]));
  assert.deepEqual([byId.a.date, byId.a.focus, byId.b.date, byId.b.focus, byId.c.date, byId.d.date], ["2026-10-22", "must", "2026-10-22", "could", day, "2026-10-22"]);
  const inbox = Object.fromEntries(P.closeDay(items, day, "inbox").map((item) => [item.id, item]));
  assert.deepEqual([inbox.a.date, inbox.d.date, inbox.d.start, inbox.c.date], [null, null, null, day]);
  assert.equal(P.closeDay(items, day, "stay"), items);
});

test("reminders cover timed tasks, habits and meetings today and tomorrow", () => {
  const now = new Date(2026, 9, 21, 9, 0); // Wednesday 21 October 2026, 09:00
  const local = (d, h, m = 0) => new Date(2026, 9, d, h, m);
  const items = [
    P.normalizeItem({ id: "a", title: "Dentista", date: "2026-10-21", start: "14:30" }),
    P.normalizeItem({ id: "b", title: "Feita", date: "2026-10-21", start: "15:00", done: true }),
    P.normalizeItem({ id: "c", title: "Depois", date: "2026-10-21", start: "16:00", focus: "later" }),
    P.normalizeItem({ id: "d", title: "Amanhã", date: "2026-10-22", start: "08:00" }),
    P.normalizeItem({ id: "e", title: "Sem hora", date: "2026-10-21" }),
    P.normalizeItem({ id: "f", title: "Longe", date: "2026-10-25", start: "08:00" }),
  ];
  const habits = P.normalizeHabits([{ id: "gym", name: "Academia", days: [3, 5], start: "18:00", duration: 60 }]);
  const events = [
    { id: "m1", title: "Daily", allDay: false, start: local(21, 9, 30).toISOString(), end: local(21, 9, 45).toISOString() },
    { id: "m2", title: "Feriado", allDay: true, start: "2026-10-22", end: "2026-10-23" },
    { id: "m3", title: "Retro", allDay: false, start: local(24, 16).toISOString(), end: local(24, 17).toISOString() },
  ];
  const list = P.reminders({ items, habits, events, now, lead: 10, morningAt: "08:00" });
  assert.deepEqual(list.map((r) => [r.kind, r.title, r.start, r.iso]), [
    ["morning", "", "08:00", "2026-10-21"],
    ["meeting", "Daily", "09:30", "2026-10-21"],
    ["task", "Dentista", "14:30", "2026-10-21"],
    ["habit", "Academia", "18:00", "2026-10-21"],
    ["task", "Amanhã", "08:00", "2026-10-22"],
  ]);
  assert.equal(list[1].at, local(21, 9, 20).getTime());
  assert.equal(new Set(list.map((r) => r.key)).size, list.length);
  assert.deepEqual(P.reminders({ now, kinds: { tasks: false, habits: false, meetings: false }, closureAt: "21:30" }).map((r) => [r.kind, r.key]),
    [["closure", "closure:2026-10-21"]]);
  const quiet = P.reminders({ items, habits, events, now, lead: 5, kinds: { tasks: false, meetings: false } });
  assert.deepEqual(quiet.map((r) => r.kind), ["habit"]);
  const doneGym = P.reminders({ habits, habitLog: { "2026-10-21": ["gym"] }, now, kinds: { tasks: false, meetings: false } });
  assert.deepEqual(doneGym, []);
});

test("calendar events split into all-day and timed slices of a local day", () => {
  const local = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
  const events = [
    { id: "a", title: "Feriado", allDay: true, start: "2026-11-02", end: "2026-11-03" },
    { id: "b", title: "Viagem", allDay: true, start: "2026-11-01", end: "2026-11-04" },
    { id: "c", title: "Reunião", allDay: false, start: local(2026, 11, 2, 9), end: local(2026, 11, 2, 10, 30), busy: true },
    { id: "d", title: "Plantão", allDay: false, start: local(2026, 11, 1, 22), end: local(2026, 11, 2, 2), busy: true },
    { id: "e", title: "Ontem", allDay: false, start: local(2026, 11, 1, 9), end: local(2026, 11, 1, 10), busy: true },
    { id: "f", title: "Lembrete", allDay: false, start: local(2026, 11, 2, 15), end: local(2026, 11, 2, 15), busy: false },
  ];
  const day = P.eventsForDay(events, "2026-11-02");
  assert.deepEqual(day.allDay.map((event) => event.title), ["Feriado", "Viagem"]);
  assert.deepEqual(day.timed.map((event) => [event.title, event.startMin, event.endMin]), [
    ["Plantão", 0, 120], ["Reunião", 540, 630], ["Lembrete", 900, 915],
  ]);
  assert.deepEqual(P.eventsForDay(events, "2026-11-04").allDay, []);
  assert.equal(P.busyMinutes(events, "2026-11-02"), 210);
  const overlapping = [
    { id: "x", allDay: false, start: local(2026, 11, 3, 9), end: local(2026, 11, 3, 11), busy: true },
    { id: "y", allDay: false, start: local(2026, 11, 3, 10), end: local(2026, 11, 3, 12), busy: true },
  ];
  assert.equal(P.busyMinutes(overlapping, "2026-11-03"), 180);
  const load = P.mentalLoad([], "2026-11-03", { events: overlapping });
  assert.equal(load.factors.meetings, 3);
  assert.equal(load.score, 2);
});

test("a day chopped into many calls weighs more than one long meeting", () => {
  const at = (hour, minute = 0) => new Date(2026, 10, 4, hour, minute).toISOString();
  const call = (id, [h1, m1], [h2, m2], busy = true) => ({ id, allDay: false, start: at(h1, m1), end: at(h2, m2), busy });
  const chopped = [
    call("a", [9, 0], [9, 30]), call("b", [9, 40], [10, 10]), call("c", [10, 15], [10, 45]),
    call("d", [13, 0], [13, 30]), call("e", [15, 0], [15, 30]), call("f", [16, 0], [16, 30]),
    call("free", [17, 0], [18, 0], false),
  ];
  const workshop = [call("w", [9, 0], [12, 0])];
  assert.deepEqual(P.callStats(chopped, "2026-11-04"), { count: 6, streak: 3 });
  assert.deepEqual(P.callStats([call("x", [9, 0], [10, 0]), call("y", [10, 20], [11, 0])], "2026-11-04"), { count: 2, streak: 1 });
  const choppedLoad = P.mentalLoad([], "2026-11-04", { events: chopped });
  const workshopLoad = P.mentalLoad([], "2026-11-04", { events: workshop });
  assert.equal(choppedLoad.factors.meetings, workshopLoad.factors.meetings);
  assert.deepEqual([choppedLoad.factors.calls, choppedLoad.factors.backToBack], [6, 3]);
  assert.deepEqual([workshopLoad.factors.calls, workshopLoad.factors.backToBack], [1, 0]);
  assert.ok(choppedLoad.score > workshopLoad.score);
  // 1.5 (hours) + 0.9 (three calls past the third) + 0.5 (back to back) → 3 (rounded)
  assert.equal(choppedLoad.score, 3);
  assert.equal(workshopLoad.score, 2);
});

test("perceived load can be set and cleared; postpone picks the last plain could-do", () => {
  let loads = P.setLoad({}, "2026-10-21", 6);
  assert.deepEqual(loads, { "2026-10-21": 6 });
  assert.deepEqual(P.setLoad(loads, "2026-10-21", 6), {});
  assert.deepEqual(P.setLoad({}, "2026-10-21", 11), {});
  const day = "2026-10-21";
  const items = [
    P.normalizeItem({ id: "a", title: "a", date: day, order: 1 }),
    P.normalizeItem({ id: "b", title: "b", date: day, order: 2 }),
    P.normalizeItem({ id: "c", title: "c", date: day, order: 3, start: "10:00" }),
    P.normalizeItem({ id: "d", title: "d", date: day, order: 4, focus: "must" }),
  ];
  assert.equal(P.postponeCandidate(items, day).id, "b");
  assert.equal(P.postponeCandidate([], day), null);
});

test("focus groups: urgent items start as must, moves can change group", () => {
  assert.equal(P.normalizeItem({ title: "a" }).focus, "could");
  assert.equal(P.normalizeItem({ title: "b", priority: "urgent" }).focus, "must");
  assert.equal(P.normalizeItem({ title: "c", focus: "later" }).focus, "later");
  assert.equal(P.normalizeItem({ title: "d", focus: "nope" }).focus, "could");
  const items = [P.normalizeItem({ id: "x", title: "x", date: "2026-10-21" })];
  assert.equal(P.moveItem(items, "x", { date: "2026-10-21", focus: "must" })[0].focus, "must");
  assert.equal(P.moveItem(items, "x", { date: "2026-10-22" })[0].focus, "could");
});

test("water goal snaps to 250 ml steps between 0.5 and 5 L", () => {
  assert.equal(P.clampWaterGoal(2000), 2000);
  assert.equal(P.clampWaterGoal(1830), 1750);
  assert.equal(P.clampWaterGoal(100), 500);
  assert.equal(P.clampWaterGoal(9000), 5000);
  assert.equal(P.clampWaterGoal("x"), 2000);
});

test("water: target glasses, per-day counts and liters", () => {
  assert.equal(P.waterTarget(2000, 250), 8);
  assert.equal(P.waterTarget(2000, 300), 7);
  assert.equal(P.waterTarget(1500, 500), 3);
  assert.equal(P.waterTarget(2000, 1200), 2);
  assert.ok(P.isBottle(750) && !P.isBottle(300));
  let water = P.setWater({}, "2026-10-20", 3);
  assert.deepEqual(water, { "2026-10-20": 3 });
  water = P.setWater(water, "2026-10-20", 0);
  assert.deepEqual(water, {});
  assert.deepEqual(P.setWater({}, "2026-10-20", 99), { "2026-10-20": 30 });
  assert.deepEqual(P.setWater({}, "2026-10-20", -2), {});
  assert.equal(P.formatLiters(1250, "pt"), "1,25 L");
  assert.equal(P.formatLiters(2000, "en"), "2 L");
  assert.equal(P.formatLiters(1500, "en"), "1.5 L");
  assert.equal(P.formatVolume(63, "pt"), "60 ml");
  assert.equal(P.formatVolume(750, "pt"), "750 ml");
  assert.equal(P.formatVolume(1250, "pt"), "1,25 L");
});

test("picking a mood sets it, picking it again clears it", () => {
  let moods = P.setMood({}, "2026-10-20", "good");
  assert.deepEqual(moods, { "2026-10-20": "good" });
  moods = P.setMood(moods, "2026-10-21", "rough");
  moods = P.setMood(moods, "2026-10-20", "great");
  assert.deepEqual(moods, { "2026-10-20": "great", "2026-10-21": "rough" });
  moods = P.setMood(moods, "2026-10-20", "great");
  assert.deepEqual(moods, { "2026-10-21": "rough" });
  assert.deepEqual(P.setMood(moods, "2026-10-21", "nope"), {});
  assert.deepEqual(P.setMood({}, "2026-10-22", "stressed"), { "2026-10-22": "stressed" });
});

test("page quotes cycle through the chosen style", () => {
  for (const style of ["proverbs", "motivational", "ironic"]) {
    const list = P.QUOTES[style];
    assert.equal(P.quoteFor(style, 1), list[0]);
    assert.equal(P.quoteFor(style, list.length + 1), list[0]);
    assert.ok(list.every((quote) => quote.en && quote.pt));
  }
  assert.equal(P.quoteFor("off", 3), null);
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
