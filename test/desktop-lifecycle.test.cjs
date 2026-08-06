const test = require("node:test");
const assert = require("node:assert/strict");
const { hideWindowOnClose } = require("../desktop-lifecycle.cjs");

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
