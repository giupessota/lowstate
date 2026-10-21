// Read-only calendar subscriptions for the desktop app.
//
// People paste a calendar's secret iCal address (Google "Secret address in
// iCal format", Outlook "Publish calendar → ICS", iCloud public calendar).
// The main process fetches and parses it — browsers can't, Google's feed has
// no CORS — and hands the renderer plain events. The address is a password
// to the calendar, so it never leaves this process: it is stored encrypted
// when the OS offers it, kept out of the renderer's backups, and only a
// masked host is ever shown.

const fs = require("fs");
const https = require("https");
const path = require("path");
const ICAL = require("ical.js");

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT = 20000;
const MAX_OCCURRENCES = 3000;
const DAY = 86400000;
// Events are expanded for this window around "now".
const WINDOW_PAST_DAYS = 62;
const WINDOW_FUTURE_DAYS = 400;

class CalendarError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// webcal:// is how calendar apps advertise subscription links; it is plain
// https underneath. Anything that isn't https is refused.
function normalizeCalendarUrl(input) {
  const text = String(input || "").trim().replace(/^webcals?:\/\//i, "https://");
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  return url.protocol === "https:" && url.hostname ? url.toString() : null;
}

function maskUrl(url) {
  try {
    return `${new URL(url).hostname}/…`;
  } catch {
    return "…";
  }
}

function fetchCalendar(url, { redirects = 5, timeout = FETCH_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { "User-Agent": "Lowstate", Accept: "text/calendar, text/plain, */*" },
      timeout,
    }, (response) => {
      const { statusCode = 0, headers } = response;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        response.resume();
        if (redirects <= 0) return reject(new CalendarError("network"));
        const next = normalizeCalendarUrl(new URL(headers.location, url).toString());
        if (!next) return reject(new CalendarError("invalid-url"));
        return resolve(fetchCalendar(next, { redirects: redirects - 1, timeout }));
      }
      if (statusCode !== 200) {
        response.resume();
        const code = statusCode === 401 || statusCode === 403 ? "forbidden" : statusCode === 404 ? "not-found" : "http";
        return reject(new CalendarError(code));
      }
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          request.destroy();
          reject(new CalendarError("too-large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (!/BEGIN:VCALENDAR/i.test(text)) reject(new CalendarError("not-calendar"));
        else resolve(text);
      });
      response.on("error", () => reject(new CalendarError("network")));
    });
    request.on("timeout", () => {
      request.destroy();
      reject(new CalendarError("timeout"));
    });
    request.on("error", () => reject(new CalendarError("network")));
  });
}

// ---------- parsing ----------

function isCancelled(component) {
  return String(component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED";
}

function toEvent(calendarId, item, start, end) {
  const allDay = start.isDate;
  const base = {
    calendarId,
    title: String(item.summary || "").trim(),
    location: String(item.location || "").trim(),
    busy: String(item.component.getFirstPropertyValue("transp") || "").toUpperCase() !== "TRANSPARENT",
    allDay,
  };
  if (allDay) {
    const startDate = start.toString().slice(0, 10);
    // DTEND of an all-day event is exclusive; a missing one means one day.
    let endDate = end && end.isDate ? end.toString().slice(0, 10) : null;
    if (!endDate || endDate <= startDate) {
      const next = start.clone();
      next.day += 1;
      endDate = next.toString().slice(0, 10);
    }
    return { ...base, id: `${calendarId}:${item.uid}:${startDate}`, start: startDate, end: endDate };
  }
  const startAt = start.toJSDate();
  const endAt = end ? end.toJSDate() : new Date(startAt.getTime());
  return {
    ...base,
    id: `${calendarId}:${item.uid}:${startAt.toISOString()}`,
    start: startAt.toISOString(),
    end: (endAt > startAt ? endAt : startAt).toISOString(),
  };
}

function overlaps(event, from, to) {
  if (event.allDay) {
    const fromDay = from.toISOString().slice(0, 10);
    const toDay = to.toISOString().slice(0, 10);
    return event.end > fromDay && event.start <= toDay;
  }
  return new Date(event.end) >= from && new Date(event.start) <= to;
}

// Turns an iCalendar text into plain events between `from` and `to`,
// expanding recurrences (with EXDATEs and moved/cancelled occurrences).
function eventsFromCalendar(text, { calendarId = "cal", from, to }) {
  const root = new ICAL.Component(ICAL.parse(text));
  root.getAllSubcomponents("vtimezone").forEach((zone) => {
    const timezone = new ICAL.Timezone(zone);
    if (timezone.tzid && !ICAL.TimezoneService.has(timezone.tzid)) ICAL.TimezoneService.register(timezone);
  });

  const masters = new Map();
  const exceptions = [];
  root.getAllSubcomponents("vevent").forEach((component) => {
    const event = new ICAL.Event(component);
    if (!event.uid || !event.startDate) return;
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  });
  const orphans = [];
  exceptions.forEach((exception) => {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else orphans.push(exception);
  });

  const out = [];
  const push = (event) => {
    if (overlaps(event, from, to)) out.push(event);
  };

  [...masters.values(), ...orphans].forEach((event) => {
    if (!event.isRecurring() || event.isRecurrenceException()) {
      if (!isCancelled(event.component)) push(toEvent(calendarId, event, event.startDate, event.endDate));
      return;
    }
    const iterator = event.iterator();
    let next;
    let count = 0;
    while ((next = iterator.next()) && count++ < MAX_OCCURRENCES) {
      if (next.toJSDate() > to) break;
      const details = event.getOccurrenceDetails(next);
      if (isCancelled(details.item.component)) continue;
      push(toEvent(calendarId, details.item, details.startDate, details.endDate));
    }
  });

  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

function expansionWindow(now = Date.now()) {
  return { from: new Date(now - WINDOW_PAST_DAYS * DAY), to: new Date(now + WINDOW_FUTURE_DAYS * DAY) };
}

// ---------- subscriptions ----------

const COLORS = ["#34508a", "#d64a32", "#7c8c4a", "#e2a43a", "#8b78bd", "#3e9aa8", "#e59aa6", "#8d8a85"];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

// `encrypt`/`decrypt` wrap Electron's safeStorage (Keychain on macOS, DPAPI
// on Windows); tests pass plain functions. `fetchText` is injectable too.
function createCalendarStore({ file, cacheFile, encrypt, decrypt, fetchText = fetchCalendar, now = () => Date.now() }) {
  let calendars = (readJson(file, {}).calendars || []).filter((calendar) => calendar && calendar.id && calendar.secret);
  let cache = readJson(cacheFile, {});
  if (!cache || typeof cache !== "object") cache = {};

  const save = () => writeJson(file, { version: 1, calendars });
  const saveCache = () => writeJson(cacheFile, cache);
  const urlOf = (calendar) => decrypt(calendar.secret);

  function publicInfo(calendar) {
    let host = "…";
    try {
      host = maskUrl(urlOf(calendar));
    } catch {
      // A secret that can't be decrypted (e.g. moved to another machine)
      // shows up as an error on the next refresh.
    }
    return {
      id: calendar.id,
      name: calendar.name,
      color: calendar.color,
      enabled: calendar.enabled !== false,
      host,
      lastSync: calendar.lastSync || null,
      error: calendar.error || null,
      count: cache[calendar.id]?.events?.length || 0,
    };
  }

  async function load(calendar) {
    let url;
    try {
      url = urlOf(calendar);
    } catch {
      throw new CalendarError("decrypt");
    }
    const text = await fetchText(url);
    let events;
    try {
      events = eventsFromCalendar(text, { calendarId: calendar.id, ...expansionWindow(now()) });
    } catch {
      throw new CalendarError("not-calendar");
    }
    cache[calendar.id] = { events, syncedAt: now() };
    return events;
  }

  return {
    list: () => calendars.map(publicInfo),

    events: () => calendars
      .filter((calendar) => calendar.enabled !== false)
      .flatMap((calendar) => cache[calendar.id]?.events || []),

    async add({ name, color, url }) {
      const normalized = normalizeCalendarUrl(url);
      if (!normalized) return { ok: false, error: "invalid-url" };
      if (calendars.some((calendar) => {
        try {
          return urlOf(calendar) === normalized;
        } catch {
          return false;
        }
      })) return { ok: false, error: "duplicate" };
      const calendar = {
        id: `cal-${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: String(name || "").trim().slice(0, 60) || maskUrl(normalized).replace("/…", ""),
        color: COLORS.includes(color) ? color : COLORS[calendars.length % COLORS.length],
        enabled: true,
        secret: encrypt(normalized),
      };
      try {
        await load(calendar);
      } catch (error) {
        return { ok: false, error: error.code || "network" };
      }
      calendar.lastSync = now();
      calendars = [...calendars, calendar];
      save();
      saveCache();
      return { ok: true, calendar: publicInfo(calendar) };
    },

    update(id, changes = {}) {
      calendars = calendars.map((calendar) => {
        if (calendar.id !== id) return calendar;
        const next = { ...calendar };
        if (typeof changes.name === "string" && changes.name.trim()) next.name = changes.name.trim().slice(0, 60);
        if (COLORS.includes(changes.color)) next.color = changes.color;
        if (typeof changes.enabled === "boolean") next.enabled = changes.enabled;
        return next;
      });
      save();
    },

    remove(id) {
      calendars = calendars.filter((calendar) => calendar.id !== id);
      delete cache[id];
      save();
      saveCache();
    },

    // Fetches every enabled calendar; a failure keeps the last good events
    // and records the error to show in Settings.
    async refresh() {
      await Promise.all(calendars.filter((calendar) => calendar.enabled !== false).map(async (calendar) => {
        try {
          await load(calendar);
          calendar.lastSync = now();
          calendar.error = null;
        } catch (error) {
          calendar.error = error.code || "network";
        }
      }));
      save();
      saveCache();
    },
  };
}

module.exports = {
  CalendarError,
  normalizeCalendarUrl,
  maskUrl,
  fetchCalendar,
  eventsFromCalendar,
  expansionWindow,
  createCalendarStore,
  CALENDAR_COLORS: COLORS,
};
