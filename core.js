(function exposeLowstateCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LowstateCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function startOfDay(date) {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }

  function toISODate(date) {
    const d = startOfDay(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseISODate(str) {
    if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const [year, month, day] = str.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
      ? parsed
      : null;
  }

  function dueMeta(dueDate, now = new Date()) {
    if (!dueDate) return { status: "none", label: "" };
    const parsed = parseISODate(dueDate);
    if (!parsed) return { status: "none", label: "" };
    const due = startOfDay(parsed);
    const diff = Math.round((due - startOfDay(now)) / 86400000);
    if (diff < 0) return { status: "overdue", label: `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}` };
    if (diff === 0) return { status: "today", label: "TODAY" };
    if (diff === 1) return { status: "future", label: "TOMORROW" };
    return { status: "future", label: `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}` };
  }

  function quickDueISO(kind, now = new Date()) {
    const date = startOfDay(now);
    const weekday = date.getDay();
    if (kind === "tomorrow") date.setDate(date.getDate() + 1);
    else if (kind === "weekend") date.setDate(date.getDate() + ((6 - weekday + 7) % 7));
    else if (kind === "nextweek") date.setDate(date.getDate() + (((1 - weekday + 7) % 7) || 7));
    return toISODate(date);
  }

  function filterAndSortTodos(todos, options = {}, now = new Date()) {
    const { category = null, filter = "active", urgentOnly = false } = options;
    let visible;
    if (category) visible = todos.filter((todo) => todo.category === category);
    else if (filter === "active") visible = todos.filter((todo) => !todo.done);
    else if (filter === "done") visible = todos.filter((todo) => todo.done);
    else if (filter === "today") visible = todos.filter((todo) => !todo.done && dueMeta(todo.dueDate, now).status === "today");
    else if (filter === "overdue") visible = todos.filter((todo) => !todo.done && dueMeta(todo.dueDate, now).status === "overdue");
    else visible = todos.slice();
    if (urgentOnly) visible = visible.filter((todo) => todo.priority === "boss");
    return visible.slice().sort((a, b) => {
      const parsedA = a.dueDate ? parseISODate(a.dueDate) : null;
      const parsedB = b.dueDate ? parseISODate(b.dueDate) : null;
      const dateA = parsedA ? parsedA.getTime() : Infinity;
      const dateB = parsedB ? parsedB.getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      const orderA = a.order ?? -a.createdAt;
      const orderB = b.order ?? -b.createdAt;
      return orderA !== orderB ? orderA - orderB : b.createdAt - a.createdAt;
    });
  }

  function parseTaskCapture(input, now = new Date()) {
    let title = String(input || "");
    let priority = null;
    let dueDate;
    let category = null;

    if (/(^|\s)!urgent(?:e)?(?=\s|$)|(^|\s)!!(?=\s|$)/iu.test(title)) {
      priority = "boss";
      title = title.replace(/(^|\s)!urgent(?:e)?(?=\s|$)|(^|\s)!!(?=\s|$)/giu, " ");
    }

    const dateTokens = [
      { pattern: /(^|\s)@(today|hoje)(?=\s|$)/iu, kind: "today" },
      { pattern: /(^|\s)@(tomorrow|amanh[ãa])(?=\s|$)/iu, kind: "tomorrow" },
      { pattern: /(^|\s)@(weekend|fimdesemana)(?=\s|$)/iu, kind: "weekend" },
      { pattern: /(^|\s)@(nextweek|pr[oó]ximasemana)(?=\s|$)/iu, kind: "nextweek" },
    ];
    for (const token of dateTokens) {
      if (!token.pattern.test(title)) continue;
      dueDate = quickDueISO(token.kind, now);
      title = title.replace(new RegExp(token.pattern.source, "giu"), " ");
      break;
    }

    const categoryMatch = title.match(/(^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/u);
    if (categoryMatch) {
      category = categoryMatch[2].toUpperCase();
      title = title.replace(categoryMatch[0], " ");
    }

    return { title: title.replace(/\s+/g, " ").trim(), priority, dueDate, category };
  }

  return { startOfDay, toISODate, parseISODate, dueMeta, quickDueISO, filterAndSortTodos, parseTaskCapture };
});
