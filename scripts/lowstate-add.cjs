#!/usr/bin/env node
// Puts something into Lowstate from outside the app (e.g. Claude, when asked
// to "put this in Lowstate"). It drops a small file in the desktop app's
// inbox folder; the open app applies it within seconds — as if it had been
// typed there — and sync carries it to the other computers. If the app is
// closed, it waits there until the app opens.
//
//   node scripts/lowstate-add.cjs task "Ligar pro banco @amanhã 14h #pessoal" [--date 2026-10-27] [--focus must|could|later]
//   node scripts/lowstate-add.cjs note "Texto da nota" [--date 2026-10-27]      (today's page notes by default)
//   node scripts/lowstate-add.cjs shopping "leite, 2 pães, 1kg batata"
//   node scripts/lowstate-add.cjs dump "uma ideia solta"
//
// Tasks use the app's own capture syntax (#category, !urgente, @amanhã,
// 14h); without a date they go to "To schedule".

const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizeInboxOps } = require("../planner.js");

function dataDir() {
  if (process.env.LOWSTATE_DATA_DIR) return process.env.LOWSTATE_DATA_DIR;
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Lowstate Data");
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Lowstate Data");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Lowstate Data");
}

function parseArgs(argv) {
  const [type, ...rest] = argv;
  const options = {};
  const words = [];
  for (let index = 0; index < rest.length; index++) {
    if (rest[index] === "--date" || rest[index] === "--focus") options[rest[index].slice(2)] = rest[++index];
    else words.push(rest[index]);
  }
  return { type, text: words.join(" "), ...options };
}

const op = parseArgs(process.argv.slice(2));
const [valid] = normalizeInboxOps([op]);
if (!valid) {
  console.error("Usage: lowstate-add.cjs task|note|shopping|dump \"text\" [--date YYYY-MM-DD] [--focus must|could|later]");
  process.exit(1);
}
if (op.date && !valid.date) {
  console.error(`Not a date: ${op.date} (use YYYY-MM-DD)`);
  process.exit(1);
}

const inbox = path.join(dataDir(), "inbox");
fs.mkdirSync(inbox, { recursive: true });
const name = `${Date.now()}-${valid.id}.json`;
const temporary = path.join(inbox, `.${name}.tmp`);
fs.writeFileSync(temporary, `${JSON.stringify({ ops: [valid] })}\n`, { mode: 0o600 });
fs.renameSync(temporary, path.join(inbox, name));
console.log(`Queued ${valid.type}: ${valid.text}${valid.date ? ` (${valid.date})` : ""}${valid.focus ? ` [${valid.focus}]` : ""}`);
