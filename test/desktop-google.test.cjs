const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SCOPE, withTimeout, readClientFile, pkce, authUrl, waitForCode, exchangeCode, createGoogleAuth, createDriveClient, driveTransport,
} = require("../desktop-google.cjs");
const { createSync } = require("../desktop-sync.cjs");

const CLIENT = { clientId: "123-abc.apps.googleusercontent.com", clientSecret: "GOCSPX-secret" };

test("the client file from Google Cloud: desktop clients only", () => {
  const file = JSON.stringify({ installed: { client_id: CLIENT.clientId, client_secret: CLIENT.clientSecret, redirect_uris: ["http://localhost"] } });
  assert.deepEqual(readClientFile(file), CLIENT);
  assert.throws(() => readClientFile(JSON.stringify({ web: { client_id: CLIENT.clientId, client_secret: "x" } })), { code: "not-desktop" });
  assert.throws(() => readClientFile("not json"), { code: "not-client" });
  assert.throws(() => readClientFile(JSON.stringify({ installed: { client_id: "evil", client_secret: "x" } })), { code: "not-client" });
});

test("sign-in asks only for the app's own Drive folder, with PKCE", () => {
  const { verifier, challenge, state } = pkce();
  assert.ok(verifier.length >= 43);
  assert.notEqual(verifier, challenge);
  const url = new URL(authUrl({ clientId: CLIENT.clientId, redirectUri: "http://127.0.0.1:5555", challenge, state }));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), SCOPE);
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.appdata");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("state"), state);
});

test("the browser comes back to a local page with the code; a wrong state is refused", async () => {
  const good = waitForCode({ state: "s1" });
  const base = await good.ready;
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  const page = await fetch(`${base}/?state=s1&code=the-code`);
  assert.match(await page.text(), /Lowstate/);
  assert.equal(await good.code, "the-code");

  const bad = waitForCode({ state: "s2" });
  const other = await bad.ready;
  const rejected = assert.rejects(bad.code, { code: "failed" });
  await fetch(`${other}/?state=forged&code=x`);
  await rejected;

  const denied = waitForCode({ state: "s3" });
  const third = await denied.ready;
  const refused = assert.rejects(denied.code, { code: "denied" });
  await fetch(`${third}/?state=s3&error=access_denied`);
  await refused;

  const slow = waitForCode({ state: "s4", timeout: 20 });
  await slow.ready;
  await assert.rejects(slow.code, { code: "timeout" });
});

// A small Google: the token endpoint and the Drive appDataFolder in memory.
function fakeGoogle({ refreshToken = "refresh-1" } = {}) {
  const files = new Map();
  let next = 1;
  let accessCount = 0;
  const calls = [];
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetchFn = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.href.startsWith("https://oauth2.googleapis.com/token")) {
      const form = new URLSearchParams(options.body);
      if (form.get("grant_type") === "authorization_code") {
        if (!form.get("code_verifier")) return json(400, { error: "invalid_request" });
        return json(200, { refresh_token: refreshToken, access_token: `access-${++accessCount}`, expires_in: 3600 });
      }
      if (form.get("refresh_token") !== refreshToken) return json(400, { error: "invalid_grant" });
      return json(200, { access_token: `access-${++accessCount}`, expires_in: 3600 });
    }
    if (!/^Bearer access-\d+$/.test(options.headers?.Authorization || "")) return json(401, { error: "unauthorized" });
    if (url.pathname === "/drive/v3/files" && method === "GET") {
      assert.equal(url.searchParams.get("spaces"), "appDataFolder");
      return json(200, { files: [...files.entries()].map(([id, file]) => ({ id, name: file.name })) });
    }
    if (url.pathname === "/drive/v3/about") return json(200, { user: { emailAddress: "giu@gmail.com" } });
    const download = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (download && url.searchParams.get("alt") === "media") return new Response(files.get(download[1]).content, { status: 200 });
    if (url.pathname === "/upload/drive/v3/files" && method === "POST") {
      const parts = String(options.body).split(/--lowstate[0-9a-f]+/);
      const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1]);
      assert.deepEqual(metadata.parents, ["appDataFolder"]);
      const id = `f${next++}`;
      files.set(id, { name: metadata.name, content: parts[2].split("\r\n\r\n")[1].replace(/\r\n$/, "") });
      return json(200, { id });
    }
    const update = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (update && method === "PATCH") {
      files.get(update[1]).content = String(options.body);
      return json(200, { id: update[1] });
    }
    return json(404, {});
  };
  return { fetch: fetchFn, files, calls };
}

test("tokens: the code becomes a refresh token; a revoked one is reported as signed out", async () => {
  const google = fakeGoogle();
  const tokens = await exchangeCode({ fetch: google.fetch, client: CLIENT, code: "c", verifier: "v".repeat(43), redirectUri: "http://127.0.0.1:1" });
  assert.equal(tokens.refreshToken, "refresh-1");
  const auth = createGoogleAuth({ fetch: google.fetch, client: CLIENT, refreshToken: "refresh-1" });
  assert.equal(await auth.accessToken(), "access-2");
  assert.equal(await auth.accessToken(), "access-2");
  const revoked = createGoogleAuth({ fetch: google.fetch, client: CLIENT, refreshToken: "old" });
  await assert.rejects(revoked.accessToken(), { code: "auth" });
  const offline = createGoogleAuth({ fetch: async () => { throw new TypeError("fetch failed"); }, client: CLIENT, refreshToken: "refresh-1" });
  await assert.rejects(offline.accessToken(), { code: "unavailable" });
});

test("two computers sync through Google Drive's app folder", async (t) => {
  const google = fakeGoogle();
  const transport = () => driveTransport({
    drive: createDriveClient({ fetch: google.fetch, auth: createGoogleAuth({ fetch: google.fetch, client: CLIENT, refreshToken: "refresh-1" }) }),
    label: "giu@gmail.com",
  });
  const computers = ["work-pc", "mac"].map((name) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lowstate-g-${name}-`));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    let data = { "type-todo.planner.items.v1": JSON.stringify([{ id: `${name}-1`, title: name }]) };
    let clock = name === "mac" ? 2000 : 1000;
    const sync = createSync({
      configFile: path.join(dir, "sync.json"),
      metaFile: path.join(dir, "sync-meta.json"),
      loadData: () => data,
      saveData: (next) => { data = { ...next }; },
      hostname: name,
      platform: name === "mac" ? "darwin" : "win32",
      transportFor: transport,
      now: () => clock,
    });
    return { sync, get data() { return data; }, edit(changes) { clock += 100; data = { ...data, ...changes }; sync.noteLocal(data); }, tick() { clock += 100; } };
  });
  const [work, mac] = computers;

  await work.sync.connect({ kind: "google", label: "giu@gmail.com" });
  assert.equal(google.files.size, 1);
  assert.equal([...google.files.values()][0].name, `lowstate-device-${work.sync.info().device}.json`);
  await mac.sync.connect({ kind: "google", label: "giu@gmail.com" });
  assert.deepEqual(JSON.parse(mac.data["type-todo.planner.items.v1"]).map((item) => item.id).sort(), ["mac-1", "work-pc-1"]);
  assert.equal(mac.sync.info().target.kind, "google");
  assert.equal(mac.sync.info().target.label, "giu@gmail.com");

  work.tick();
  await work.sync.sync();
  assert.deepEqual(JSON.parse(work.data["type-todo.planner.items.v1"]).map((item) => item.id).sort(), ["mac-1", "work-pc-1"]);
  work.edit({ "type-todo.theme.v1": "dark" });
  await work.sync.sync();
  mac.tick();
  assert.deepEqual((await mac.sync.sync()).incoming, { "type-todo.theme.v1": "dark" });
  // Each computer updates its own file rather than adding new ones.
  assert.equal(google.files.size, 2);
  assert.ok(google.calls.some((call) => call.startsWith("PATCH /upload/drive/v3/files/")));
});

test("Drive trouble leaves local data alone and is reported", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-g-off-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const data = { "type-todo.theme.v1": "light" };
  const offline = async () => { throw new TypeError("fetch failed"); };
  const sync = createSync({
    configFile: path.join(dir, "sync.json"),
    metaFile: path.join(dir, "sync-meta.json"),
    loadData: () => data,
    saveData: () => assert.fail("nothing should be written"),
    hostname: "pc",
    platform: "win32",
    transportFor: () => driveTransport({ drive: createDriveClient({ fetch: offline, auth: createGoogleAuth({ fetch: offline, client: CLIENT, refreshToken: "r" }) }) }),
  });
  await sync.connect({ kind: "google" });
  assert.equal(sync.info().state, "unavailable");
  assert.match(sync.info().detail, /fetch failed/);
  const google = fakeGoogle();
  const signedOut = createSync({
    configFile: path.join(dir, "sync2.json"),
    metaFile: path.join(dir, "sync-meta2.json"),
    loadData: () => data,
    saveData: () => assert.fail("nothing should be written"),
    hostname: "pc",
    platform: "win32",
    transportFor: () => driveTransport({ drive: createDriveClient({ fetch: google.fetch, auth: createGoogleAuth({ fetch: google.fetch, client: CLIENT, refreshToken: "revoked" }) }) }),
  });
  await signedOut.connect({ kind: "google" });
  assert.equal(signedOut.info().state, "auth");
});

test("a request that never answers gives up, and a stuck exchange doesn't block the next ones", async (t) => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20), { code: "unavailable" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lowstate-hang-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const sync = createSync({
    configFile: path.join(dir, "sync.json"),
    metaFile: path.join(dir, "sync-meta.json"),
    loadData: () => ({}),
    saveData: () => {},
    hostname: "mac",
    platform: "darwin",
    exchangeLimit: 30,
    transportFor: () => ({
      kind: "google",
      // The first exchange hangs forever; later ones answer.
      readOthers: () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve([])),
      writeOwn: async () => {},
    }),
  });
  sync.connect({ kind: "google" });
  const second = await sync.sync();
  assert.deepEqual(second, { incoming: {} });
  assert.equal(sync.info().state, "idle");
  assert.equal(calls, 2);
});
