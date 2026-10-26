// Google Drive as a sync target, straight through its API — for computers
// where the Drive app can't be installed (a work PC). Lowstate signs in once
// in the browser (OAuth for desktop apps: loopback redirect + PKCE) and only
// asks for "drive.appdata": a hidden folder that only Lowstate can see, not
// the person's files. Each computer keeps one file there, exactly like the
// synced-folder transport in desktop-sync.cjs.
//
// The OAuth client (client ID and secret of a "Desktop app" client) comes
// from a Google Cloud project the person creates; for desktop apps Google
// doesn't treat that secret as confidential, but the app still keeps it,
// like the refresh token, encrypted with the OS keychain.

const crypto = require("crypto");
const http = require("http");
const { isDeviceFile } = require("./desktop-sync.cjs");

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FILE_PREFIX = "lowstate-device-";
const LOGIN_TIMEOUT = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 20000;

// A request that never answers (the computer slept mid-request, a proxy
// holding the connection) gives up instead of waiting forever: the abort
// signal alone isn't always honoured.
function withTimeout(promise, ms = REQUEST_TIMEOUT) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new GoogleError("unavailable", "timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

class GoogleError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

// The "client_secret_….json" file Google Cloud gives for an OAuth client.
function readClientFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GoogleError("not-client");
  }
  if (parsed?.web && !parsed?.installed) throw new GoogleError("not-desktop");
  const client = parsed?.installed;
  const clientId = String(client?.client_id || "");
  const clientSecret = String(client?.client_secret || "");
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId) || !clientSecret) throw new GoogleError("not-client");
  return { clientId, clientSecret };
}

const base64url = (buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function pkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge, state: base64url(crypto.randomBytes(16)) };
}

function authUrl({ clientId, redirectUri, challenge, state }) {
  const url = new URL(AUTH_URL);
  Object.entries({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

const DONE_PAGE = (title, text) => `<!doctype html><meta charset="utf-8"><title>Lowstate</title>
<body style="font:16px/1.5 system-ui,sans-serif;background:#f4f0e8;color:#2a2620;display:grid;place-items:center;height:100vh;margin:0">
<div style="max-width:420px;text-align:center"><h1 style="font-size:22px">${title}</h1><p>${text}</p></div>`;

// A one-time local page Google sends the browser back to, on 127.0.0.1 and
// a free port. Resolves with the authorization code.
function waitForCode({ state, timeout = LOGIN_TIMEOUT, pages = {} } = {}) {
  let server;
  let timer;
  let settle;
  const codePromise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  const finish = (error, code) => {
    clearTimeout(timer);
    setTimeout(() => server?.close(), 100);
    if (error) settle.reject(error);
    else settle.resolve(code);
  };
  const ready = new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname !== "/") {
        response.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get("state") === state && url.searchParams.get("code");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(ok
        ? DONE_PAGE(pages.doneTitle || "Done", pages.doneText || "You can go back to Lowstate.")
        : DONE_PAGE(pages.failTitle || "Not connected", pages.failText || "You can close this page and try again in Lowstate."));
      if (ok) finish(null, url.searchParams.get("code"));
      else finish(new GoogleError(url.searchParams.get("error") === "access_denied" ? "denied" : "failed"));
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
  timer = setTimeout(() => finish(new GoogleError("timeout")), timeout);
  return { ready, code: codePromise, cancel: () => finish(new GoogleError("cancelled")) };
}

async function postForm(fetch, url, fields) {
  let response;
  try {
    response = await withTimeout(fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    }));
  } catch {
    throw new GoogleError("unavailable");
  }
  const body = await withTimeout(response.json()).catch(() => ({}));
  if (!response.ok) throw new GoogleError(body.error === "invalid_grant" || body.error === "invalid_client" ? "auth" : "unavailable", body.error);
  return body;
}

async function exchangeCode({ fetch, client, code, verifier, redirectUri }) {
  const body = await postForm(fetch, TOKEN_URL, {
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  if (!body.refresh_token) throw new GoogleError("failed", "no refresh token");
  return { refreshToken: body.refresh_token, accessToken: body.access_token, expiresIn: body.expires_in };
}

// Short-lived access tokens from the long-lived refresh token.
function createGoogleAuth({ fetch, client, refreshToken, now = () => Date.now() }) {
  let cached = null;
  return {
    async accessToken() {
      if (cached && cached.until > now() + 60000) return cached.token;
      const body = await postForm(fetch, TOKEN_URL, {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      cached = { token: body.access_token, until: now() + (Number(body.expires_in) || 3600) * 1000 };
      return cached.token;
    },
    invalidate() {
      cached = null;
    },
  };
}

// Requests to the Drive API with the access token; one retry with a fresh
// token on 401. Network trouble is "unavailable", a lost grant is "auth".
function createDriveClient({ fetch, auth }) {
  async function request(url, options = {}, retry = true) {
    const token = await auth.accessToken();
    let response;
    try {
      response = await withTimeout(fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }));
    } catch {
      throw new GoogleError("unavailable");
    }
    if (response.status === 401 && retry) {
      auth.invalidate();
      return request(url, options, false);
    }
    if (response.status === 401) throw new GoogleError("auth");
    if (!response.ok) throw new GoogleError("unavailable", `Drive ${response.status}`);
    return response;
  }
  return {
    async list() {
      const url = new URL(`${API}/files`);
      url.searchParams.set("spaces", "appDataFolder");
      url.searchParams.set("q", `name contains '${FILE_PREFIX}' and trashed = false`);
      url.searchParams.set("fields", "files(id,name,modifiedTime)");
      url.searchParams.set("pageSize", "100");
      const body = await withTimeout((await request(url.toString())).json());
      return Array.isArray(body.files) ? body.files : [];
    },
    async download(id) {
      return withTimeout((await request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).json()).catch(() => null);
    },
    async create(name, content) {
      const boundary = `lowstate${crypto.randomBytes(8).toString("hex")}`;
      const body = [
        `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "",
        JSON.stringify({ name, parents: ["appDataFolder"], mimeType: "application/json" }),
        `--${boundary}`, "Content-Type: application/json", "",
        content,
        `--${boundary}--`, "",
      ].join("\r\n");
      const response = await request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      return (await response.json()).id;
    },
    async update(id, content) {
      await request(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: content,
      });
    },
    async account() {
      const body = await (await request(`${API}/about?fields=user(emailAddress)`)).json();
      return body?.user?.emailAddress || null;
    },
  };
}

const fileName = (device) => `${FILE_PREFIX}${device}.json`;

// The sync transport: same contract as folderTransport.
function driveTransport({ drive, label = null }) {
  let ownId = null;
  return {
    kind: "google",
    label,
    async readOthers(device) {
      const files = await drive.list();
      ownId = files.find((file) => file.name === fileName(device))?.id || ownId;
      const others = await Promise.all(files
        .filter((file) => file.name !== fileName(device))
        .map((file) => drive.download(file.id)));
      return others.filter((file) => isDeviceFile(file, device));
    },
    async writeOwn(file) {
      const content = JSON.stringify(file);
      if (!ownId) ownId = (await drive.list()).find((entry) => entry.name === fileName(file.device))?.id || null;
      if (ownId) await drive.update(ownId, content);
      else ownId = await drive.create(fileName(file.device), content);
    },
  };
}

module.exports = {
  SCOPE,
  withTimeout,
  GoogleError,
  readClientFile,
  pkce,
  authUrl,
  waitForCode,
  exchangeCode,
  createGoogleAuth,
  createDriveClient,
  driveTransport,
};
