const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  CalendarError,
  normalizeCalendarUrl,
  maskUrl,
  isMeetingUrl,
  eventsFromCalendar,
  createCalendarStore,
  sealSecrets,
  openSecrets,
} = require("../desktop-calendars.cjs");

const WINDOW = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2027-01-31T00:00:00Z") };

const ics = (...lines) => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", ...lines, "END:VCALENDAR"].join("\r\n");

const SAO_PAULO = [
  "BEGIN:VTIMEZONE", "TZID:America/Sao_Paulo",
  "BEGIN:STANDARD", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "DTSTART:19700101T000000", "END:STANDARD",
  "END:VTIMEZONE",
];

const OUTLOOK_ZONE = [
  "BEGIN:VTIMEZONE", "TZID:E. South America Standard Time",
  "BEGIN:STANDARD", "DTSTART:16010101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "END:STANDARD",
  "END:VTIMEZONE",
];

test("calendar links: webcal becomes https, other schemes are refused, hosts are masked", () => {
  assert.equal(normalizeCalendarUrl("webcal://p01-caldav.icloud.com/published/2/abc"), "https://p01-caldav.icloud.com/published/2/abc");
  assert.equal(normalizeCalendarUrl("  https://calendar.google.com/calendar/ical/x%40gmail.com/private-123/basic.ics "),
    "https://calendar.google.com/calendar/ical/x%40gmail.com/private-123/basic.ics");
  assert.equal(normalizeCalendarUrl("http://example.com/cal.ics"), null);
  assert.equal(normalizeCalendarUrl("file:///etc/passwd"), null);
  assert.equal(normalizeCalendarUrl("not a url"), null);
  assert.equal(maskUrl("https://calendar.google.com/calendar/ical/secret/basic.ics"), "calendar.google.com/…");
});

test("timed events keep their real instant across time zones (Google and Outlook)", () => {
  const events = eventsFromCalendar(ics(
    ...SAO_PAULO, ...OUTLOOK_ZONE,
    "BEGIN:VEVENT", "UID:google-1", "SUMMARY:Planejamento", "LOCATION:Sala 2",
    "DTSTART;TZID=America/Sao_Paulo:20261021T100000", "DTEND;TZID=America/Sao_Paulo:20261021T110000", "END:VEVENT",
    "BEGIN:VEVENT", "UID:outlook-1", "SUMMARY:Call com cliente",
    "DTSTART;TZID=\"E. South America Standard Time\":20261021T140000",
    "DTEND;TZID=\"E. South America Standard Time\":20261021T143000", "END:VEVENT",
  ), { calendarId: "c1", ...WINDOW });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => [event.title, event.start, event.end]), [
    ["Planejamento", "2026-10-21T13:00:00.000Z", "2026-10-21T14:00:00.000Z"],
    ["Call com cliente", "2026-10-21T17:00:00.000Z", "2026-10-21T17:30:00.000Z"],
  ]);
  assert.equal(events[0].location, "Sala 2");
  assert.equal(events[0].calendarId, "c1");
  assert.equal(events[0].allDay, false);
});

test("descriptions become plain text and video-call links are found", () => {
  const [google, outlook, plain] = eventsFromCalendar(ics(
    "BEGIN:VEVENT", "UID:g", "SUMMARY:Sync", "DTSTART:20261021T130000Z", "DTEND:20261021T140000Z",
    "X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij",
    "DESCRIPTION:<b>Pauta</b><br>1. Roadmap &amp; prazos<br><br><br>2. Dúvidas", "END:VEVENT",
    "BEGIN:VEVENT", "UID:o", "SUMMARY:Cliente", "DTSTART:20261021T150000Z", "DTEND:20261021T160000Z",
    "LOCATION:Microsoft Teams Meeting",
    "DESCRIPTION:Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0?context=1 or call", "END:VEVENT",
    "BEGIN:VEVENT", "UID:p", "SUMMARY:Almoço", "DTSTART:20261021T170000Z", "DTEND:20261021T180000Z",
    "DESCRIPTION:Menu at https://example.com/menu", "END:VEVENT",
  ), WINDOW);
  assert.equal(google.description, "Pauta\n1. Roadmap & prazos\n\n2. Dúvidas");
  assert.equal(google.link, "https://meet.google.com/abc-defg-hij");
  assert.equal(outlook.link, "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0?context=1");
  assert.equal(plain.link, null);
  assert.ok(isMeetingUrl("https://us02web.zoom.us/j/123"));
  assert.ok(!isMeetingUrl("https://zoom.us.evil.com/j/1"));
  assert.ok(!isMeetingUrl("http://meet.google.com/x"));
});

test("all-day events use dates with an exclusive end", () => {
  const [single, missingEnd, multi] = eventsFromCalendar(ics(
    "BEGIN:VEVENT", "UID:a", "SUMMARY:Feriado", "DTSTART;VALUE=DATE:20261102", "DTEND;VALUE=DATE:20261103", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b", "SUMMARY:Aniversário", "DTSTART;VALUE=DATE:20261105", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c", "SUMMARY:Viagem", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261113", "END:VEVENT",
  ), WINDOW);
  assert.deepEqual([single.allDay, single.start, single.end], [true, "2026-11-02", "2026-11-03"]);
  assert.deepEqual([missingEnd.start, missingEnd.end], ["2026-11-05", "2026-11-06"]);
  assert.deepEqual([multi.start, multi.end], ["2026-11-10", "2026-11-13"]);
});

test("recurrences expand with EXDATEs, moved and cancelled occurrences", () => {
  const events = eventsFromCalendar(ics(
    "BEGIN:VEVENT", "UID:weekly", "SUMMARY:1:1",
    "DTSTART:20261020T120000Z", "DTEND:20261020T123000Z",
    "RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=5", "EXDATE:20261027T120000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:weekly", "RECURRENCE-ID:20261103T120000Z", "SUMMARY:1:1 (moved)",
    "DTSTART:20261103T180000Z", "DTEND:20261103T183000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:weekly", "RECURRENCE-ID:20261110T120000Z", "STATUS:CANCELLED", "SUMMARY:1:1",
    "DTSTART:20261110T120000Z", "DTEND:20261110T123000Z", "END:VEVENT",
  ), WINDOW);
  assert.deepEqual(events.map((event) => [event.title, event.start]), [
    ["1:1", "2026-10-20T12:00:00.000Z"],
    ["1:1 (moved)", "2026-11-03T18:00:00.000Z"],
    ["1:1", "2026-11-17T12:00:00.000Z"],
  ]);
  assert.equal(new Set(events.map((event) => event.id)).size, 3);
});

test("open-ended recurrences stop at the window; cancelled, free and escaped text are handled", () => {
  const events = eventsFromCalendar(ics(
    "BEGIN:VEVENT", "UID:daily", "SUMMARY:Standup", "DTSTART:20261201T120000Z", "DTEND:20261201T121500Z",
    "RRULE:FREQ=DAILY", "END:VEVENT",
    "BEGIN:VEVENT", "UID:gone", "SUMMARY:Cancelada", "STATUS:CANCELLED", "DTSTART:20261021T150000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:free", "SUMMARY:Reuni\\, almoço", "TRANSP:TRANSPARENT",
    "DTSTART:20261022T150000Z", "DTEND:20261022T160000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:old", "SUMMARY:Antiga", "DTSTART:20200101T100000Z", "DTEND:20200101T110000Z", "END:VEVENT",
  ), WINDOW);
  const standups = events.filter((event) => event.title === "Standup");
  assert.equal(standups.length, 61);
  assert.equal(standups.at(-1).start, "2027-01-30T12:00:00.000Z");
  assert.ok(!events.some((event) => event.title === "Cancelada" || event.title === "Antiga"));
  const free = events.find((event) => event.title === "Reuni, almoço");
  assert.equal(free.busy, false);
  assert.equal(standups[0].busy, true);
});

const FEED = ics(
  "BEGIN:VEVENT", "UID:x", "SUMMARY:Reunião", "DTSTART:20261021T130000Z", "DTEND:20261021T140000Z", "END:VEVENT",
);

function makeStore(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-cal-"));
  const options = {
    file: path.join(dir, "calendars.json"),
    cacheFile: path.join(dir, "calendar-events.json"),
    encrypt: (text) => Buffer.from(text).toString("base64"),
    decrypt: (text) => Buffer.from(text, "base64").toString(),
    fetchText: async () => FEED,
    now: () => Date.parse("2026-10-21T10:00:00Z"),
    ...overrides,
  };
  return { dir, options, store: createCalendarStore(options) };
}

test("adding a calendar fetches it, stores the link encrypted and never exposes it", async () => {
  const { options, store } = makeStore();
  const url = "https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc/basic.ics";
  const result = await store.add({ name: "Pessoal", color: "#3e9aa8", url });
  assert.equal(result.ok, true);
  assert.deepEqual(
    { ...result.calendar, id: "-" },
    { id: "-", name: "Pessoal", color: "#3e9aa8", enabled: true, host: "calendar.google.com/…", lastSync: Date.parse("2026-10-21T10:00:00Z"), error: null, count: 1 });
  assert.ok(!JSON.stringify(store.list()).includes("private-abc"));
  assert.ok(!fs.readFileSync(options.file, "utf8").includes("private-abc"));
  assert.equal(store.events().length, 1);
  assert.equal(store.events()[0].calendarId, result.calendar.id);

  assert.deepEqual(await store.add({ url }), { ok: false, error: "duplicate" });
  assert.deepEqual(await store.add({ url: "http://x.com/a.ics" }), { ok: false, error: "invalid-url" });

  // A second store reading the same files sees the same calendars.
  const again = createCalendarStore(options);
  assert.equal(again.list().length, 1);
  assert.equal(again.events().length, 1);
});

test("a failing link is not added; a failing refresh keeps the last events and records the error", async () => {
  let fail = false;
  const { store } = makeStore({
    fetchText: async (url) => {
      if (url.includes("broken") || fail) throw new CalendarError("not-found");
      return FEED;
    },
  });
  assert.deepEqual(await store.add({ url: "https://example.com/broken.ics" }), { ok: false, error: "not-found" });
  const { calendar } = await store.add({ name: "Trabalho", url: "https://example.com/ok.ics" });
  fail = true;
  await store.refresh();
  assert.equal(store.list()[0].error, "not-found");
  assert.equal(store.events().length, 1);

  store.update(calendar.id, { enabled: false, name: "Work", color: "#d64a32" });
  assert.deepEqual([store.list()[0].name, store.list()[0].color, store.list()[0].enabled], ["Work", "#d64a32", false]);
  assert.equal(store.events().length, 0);

  store.remove(calendar.id);
  assert.equal(store.list().length, 0);
});

test("a feed that isn't a calendar is rejected", async () => {
  const { store } = makeStore({ fetchText: async () => "BEGIN:VCALENDAR\r\nthis is not valid" });
  const result = await store.add({ url: "https://example.com/x.ics" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "not-calendar");
});

test("calendar links go into a backup only encrypted with a password", () => {
  const list = [{ name: "Trabalho", color: "#34508a", enabled: true, url: "https://calendar.google.com/calendar/ical/x/private-abc/basic.ics" }];
  const sealed = sealSecrets(list, "minha senha");
  assert.ok(!JSON.stringify(sealed).includes("private-abc"));
  assert.deepEqual(openSecrets(sealed, "minha senha"), list);
  assert.throws(() => openSecrets(sealed, "outra"), { code: "password" });
  assert.throws(() => openSecrets({ ...sealed, data: Buffer.from("tampered").toString("base64") }, "minha senha"), { code: "password" });
  assert.throws(() => sealSecrets(list, "123"), { code: "password-short" });
  assert.throws(() => openSecrets({ v: 9 }, "x"), { code: "sealed-format" });
});

test("restoring calendars from a backup skips links already here", async () => {
  const { store } = makeStore();
  await store.add({ name: "Pessoal", url: "https://example.com/a.ics" });
  const exported = store.exportAll();
  assert.deepEqual(exported.map((entry) => [entry.name, entry.url]), [["Pessoal", "https://example.com/a.ics"]]);
  const { store: other, options } = makeStore();
  assert.equal(other.restore([...exported, { name: "Trabalho", color: "#d64a32", url: "webcal://example.com/b.ics" }, { url: "http://bad" }]), 2);
  assert.deepEqual(other.list().map((calendar) => [calendar.name, calendar.color]), [["Pessoal", exported[0].color], ["Trabalho", "#d64a32"]]);
  assert.ok(!fs.readFileSync(options.file, "utf8").includes("example.com/b.ics"));
  assert.equal(other.restore(exported), 0);
});

test("calendar sync: this computer follows the other's list; the first time both are kept", async () => {
  const { store } = makeStore();
  await store.add({ name: "Pessoal", url: "https://example.com/mine.ics" });
  const theirs = [
    { name: "Trabalho", color: "#d64a32", enabled: true, url: "https://example.com/work.ics" },
    { name: "Feriados", color: "#3e9aa8", enabled: false, url: "https://example.com/holidays.ics" },
  ];
  // First time: union.
  assert.equal(store.syncTo(theirs, { keepLocal: true }), 2);
  assert.deepEqual(store.list().map((c) => [c.name, c.enabled]).sort(), [["Feriados", false], ["Pessoal", true], ["Trabalho", true]]);
  // Afterwards: the list wins — renamed, recolored, and a removal travels.
  const next = [{ ...theirs[0], name: "Work", color: "#7c8c4a" }];
  assert.equal(store.syncTo(next), 3);
  assert.deepEqual(store.list().map((c) => [c.name, c.color]), [["Work", "#7c8c4a"]]);
  assert.equal(store.syncTo(next), 0);
});
