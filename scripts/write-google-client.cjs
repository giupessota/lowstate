// CI: writes google-client.json (the app's own Google "Desktop app" OAuth
// client) from the GOOGLE_CLIENT_JSON secret, so builds can offer "Sign in
// with Google" without asking for the file. The file is never committed.
// Without the secret, nothing is written and the app asks for the file.
const fs = require("fs");
const path = require("path");
const { readClientFile } = require("../desktop-google.cjs");

const text = process.env.GOOGLE_CLIENT_JSON || "";
if (!text.trim()) {
  console.log("No GOOGLE_CLIENT_JSON secret: the app will ask for the Google file.");
  process.exit(0);
}
const client = readClientFile(text);
fs.writeFileSync(path.join(__dirname, "..", "google-client.json"), `${JSON.stringify(client)}\n`, { mode: 0o600 });
console.log("google-client.json written.");
