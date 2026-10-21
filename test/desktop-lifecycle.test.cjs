const test = require("node:test");
const assert = require("node:assert/strict");
const { hideWindowOnClose, isNewerVersion } = require("../desktop-lifecycle.cjs");

test("closing the gadget hides it so global shortcuts stay registered", () => {
  let prevented = false;
  let hidden = false;
  const handled = hideWindowOnClose(
    { preventDefault: () => { prevented = true; } },
    { hide: () => { hidden = true; } },
    false
  );

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.equal(hidden, true);
});

test("quitting lets the desktop window close normally", () => {
  let prevented = false;
  let hidden = false;
  const handled = hideWindowOnClose(
    { preventDefault: () => { prevented = true; } },
    { hide: () => { hidden = true; } },
    true
  );

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.equal(hidden, false);
});

test("update check understands beta versions", () => {
  assert.equal(isNewerVersion("1.1.8", "1.1.7"), true);
  assert.equal(isNewerVersion("1.1.7", "2.0.0-beta.1"), false);
  assert.equal(isNewerVersion("2.0.0", "2.0.0-beta.1"), true);
  assert.equal(isNewerVersion("2.0.0-beta.2", "2.0.0-beta.1"), true);
  assert.equal(isNewerVersion("2.0.0-beta.10", "2.0.0-beta.9"), true);
  assert.equal(isNewerVersion("2.0.0-beta.1", "2.0.0"), false);
  assert.equal(isNewerVersion("v2.0.0", "2.0.0"), false);
});
