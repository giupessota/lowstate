// electron-builder afterSign hook. On CI there's no paid Apple Developer
// identity, so the .app only carries the partial ad-hoc signature the linker
// puts on the arm64 binary — that signature doesn't cover the resources
// electron-builder copies in afterward, so the seal and the contents don't
// match. Gatekeeper reports that mismatch as "is damaged and can't be
// opened" (a dead end, no bypass) instead of the milder, expected "unknown
// developer" prompt. Re-signing the whole bundle ad-hoc after packaging
// makes the seal consistent again and restores the normal prompt, which the
// README already documents how to get past.
const { execFileSync } = require("child_process");
const path = require("path");

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
