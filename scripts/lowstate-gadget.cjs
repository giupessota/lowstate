#!/usr/bin/env node
// Connects the little desk screen (gadget/) to the same Google Drive the
// desktop app syncs through. It signs in with Google in the browser — with
// the app's own client (google-client.json), so the screen sees the same
// hidden app folder — checks that the folder has Lowstate's files, and
// writes the screen's settings to gadget/include/secrets.h (not committed),
// keeping the Wi-Fi name and password already typed there.
//
// The screen gets its own sign-in, so it can be removed on its own at
// myaccount.google.com → Security → Third-party access.
//
//   node scripts/lowstate-gadget.cjs [--client path/to/client.json] [--place "Paulínia"]
//   node scripts/lowstate-gadget.cjs --roots-only   (just the certificates)
//
// macOS only for now: the Google root certificates and the time zone rule
// come from the system (no downloads).

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  readClientFile, pkce, authUrl, waitForCode, exchangeCode, createGoogleAuth, createDriveClient,
} = require("../desktop-google.cjs");

const ROOT = path.join(__dirname, "..");
const SECRETS = path.join(ROOT, "gadget", "include", "secrets.h");
const ROOTS = path.join(ROOT, "gadget", "include", "tls_roots.h");
// Roots the screen trusts: Google's APIs, and Let's Encrypt (Open-Meteo, the weather).
const ROOT_NAMES = ["GTS Root R1", "GTS Root R2", "GTS Root R3", "GTS Root R4", "GlobalSign Root CA", "ISRG Root X1", "ISRG Root X2"];

function readClient() {
  const flag = process.argv.indexOf("--client");
  const file = flag > 0 ? process.argv[flag + 1] : path.join(ROOT, "google-client.json");
  const text = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(text);
  return parsed.clientId && parsed.clientSecret ? parsed : readClientFile(text);
}

// "<-03>3" for São Paulo: the POSIX rule at the end of the system's tz file.
function posixTimeZone() {
  try {
    const lines = fs.readFileSync(fs.realpathSync("/etc/localtime"), "latin1").split("\n").filter(Boolean);
    const rule = lines[lines.length - 1];
    if (/^[<>\w+\-,.:/]+$/.test(rule)) return rule;
  } catch {}
  return "UTC0";
}

// The city for the home screen and the weather: --place, or else the city
// of the time zone ("SÃO PAULO" for America/Sao_Paulo).
const ACCENTS = { "SAO PAULO": "SÃO PAULO", BELEM: "BELÉM", MACEIO: "MACEIÓ", CUIABA: "CUIABÁ", ARAGUAINA: "ARAGUAÍNA" };
function placeName() {
  const flag = process.argv.indexOf("--place");
  if (flag > 0 && process.argv[flag + 1]) return process.argv[flag + 1].toUpperCase();
  try {
    const zone = fs.realpathSync("/etc/localtime").split("/zoneinfo/")[1] || "";
    const city = (zone.split("/").pop() || "").replace(/_/g, " ").toUpperCase();
    return ACCENTS[city] || city;
  } catch {
    return "";
  }
}

function googleRoots() {
  const keychain = "/System/Library/Keychains/SystemRootCertificates.keychain";
  return ROOT_NAMES.map((name) => {
    const pems = execFileSync("security", ["find-certificate", "-a", "-p", "-c", name, keychain], { encoding: "utf8" })
      .match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
    // "-c" matches by substring; keep the certificate whose subject CN is exactly the name.
    const exact = pems.find((pem) => new crypto.X509Certificate(pem).subject.split("\n").includes(`CN=${name}`));
    if (!exact) throw new Error(`Root certificate not found: ${name}`);
    return `// ${name}\n${exact.trim()}\n`;
  }).join("");
}

const cString = (text) => JSON.stringify(String(text));

function keptDefine(text, name) {
  const match = new RegExp(`#define ${name} ("(?:[^"\\\\]|\\\\.)*")`).exec(text || "");
  return match ? JSON.parse(match[1]) : "";
}

function writeRoots() {
  fs.writeFileSync(ROOTS, `// Root certificates the screen trusts (Google's APIs; Let's Encrypt for the
// weather), from the macOS system store (scripts/lowstate-gadget.cjs). Public data.
#pragma once

static const char TLS_ROOTS[] = R"PEM(
${googleRoots()})PEM";
`);
}

// The city's coordinates, for the weather (Open-Meteo's free geocoding).
async function placeCoordinates(place) {
  if (!place) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name=${encodeURIComponent(place.toLowerCase())}`;
    const found = (await (await fetch(url)).json()).results?.[0];
    return found ? { lat: found.latitude, lon: found.longitude } : null;
  } catch {
    return null;
  }
}

async function main() {
  if (process.argv.includes("--roots-only")) {
    writeRoots();
    console.log(`Certificados gravados em ${path.relative(process.cwd(), ROOTS)}.`);
    return;
  }
  const client = readClient();
  const { verifier, challenge, state } = pkce();
  const login = waitForCode({
    state,
    pages: {
      doneTitle: "Lowstate", doneText: "A telinha está conectada. Pode fechar esta aba.",
      failTitle: "Não conectou", failText: "Feche esta aba e rode o script de novo.",
    },
  });
  const redirectUri = await login.ready;
  const url = authUrl({ clientId: client.clientId, redirectUri, challenge, state });
  console.log("Abrindo o navegador para entrar com o Google...");
  console.log(`Se não abrir, cole este endereço no navegador:\n${url}\n`);
  try { execFileSync("open", [url]); } catch {}

  const code = await login.code;
  const tokens = await exchangeCode({ fetch, client, code, verifier, redirectUri });
  const auth = createGoogleAuth({ fetch, client, refreshToken: tokens.refreshToken });
  const drive = createDriveClient({ fetch, auth });
  const files = await drive.list();
  const agenda = await drive.findByName("lowstate-agenda.json");
  console.log(`Arquivos do Lowstate no Drive: ${files.length} computador(es)${agenda ? " + agenda" : ""}.`);
  if (!files.length) console.log("Atenção: nenhum arquivo encontrado. A conta é a mesma que o app usa em Ajustes → Mesmos dados nos seus computadores?");

  let previous = "";
  try { previous = fs.readFileSync(SECRETS, "utf8"); } catch {}
  const device = keptDefine(previous, "GADGET_DEVICE") || `gadget-${crypto.randomBytes(4).toString("hex")}`;

  const place = placeName();
  const coords = await placeCoordinates(place);
  const secrets = `// Settings for the little desk screen. Written by scripts/lowstate-gadget.cjs;
// not committed (Wi-Fi password and the screen's Google sign-in).
#pragma once

#define WIFI_SSID ${cString(keptDefine(previous, "WIFI_SSID"))}
#define WIFI_PASSWORD ${cString(keptDefine(previous, "WIFI_PASSWORD"))}

#define GOOGLE_CLIENT_ID ${cString(client.clientId)}
#define GOOGLE_CLIENT_SECRET ${cString(client.clientSecret)}
#define GOOGLE_REFRESH_TOKEN ${cString(tokens.refreshToken)}

// This screen's name in the sync (its file is lowstate-device-<this>.json).
#define GADGET_DEVICE ${cString(device)}
#define GADGET_NAME "Telinha"

// POSIX time zone rule of this computer, its city for the home screen, and
// where the weather is looked up.
#define GADGET_TZ ${cString(posixTimeZone())}
#define GADGET_PLACE ${cString(place)}
#define GADGET_LAT ${coords ? coords.lat : 0}
#define GADGET_LON ${coords ? coords.lon : 0}
`;
  fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
  fs.writeFileSync(SECRETS, secrets, { mode: 0o600 });

  writeRoots();

  console.log(`Configuração da telinha gravada em ${path.relative(process.cwd(), SECRETS)}.`);
  if (!keptDefine(previous, "WIFI_SSID")) console.log("Preencha o nome e a senha do Wi-Fi nesse arquivo antes de gravar a placa.");
}

main().catch((error) => {
  console.error(`Não deu certo: ${error.code || error.message}`);
  process.exit(1);
});
