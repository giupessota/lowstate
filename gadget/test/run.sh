#!/bin/sh
# Builds and runs the screen's day-logic test on this computer.
# Needs the ArduinoJson that PlatformIO downloads (run `pio run` once first).
set -e
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
c++ -std=c++17 -Wall -Wextra -DARDUINOJSON_USE_LONG_LONG=1 \
  -I .pio/libdeps/cyd/ArduinoJson/src \
  test/planner_test.cpp src/planner.cpp -o "$OUT/planner_test"
"$OUT/planner_test"
rm -rf "$OUT"
