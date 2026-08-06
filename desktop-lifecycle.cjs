function hideWindowOnClose(event, targetWindow, isQuitting) {
  if (isQuitting) return false;
  event.preventDefault();
  targetWindow.hide();
  return true;
}

module.exports = { hideWindowOnClose };
