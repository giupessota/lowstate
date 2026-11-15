#!/bin/sh
# Validate the direct OpenAI protocol locally, without a network or credentials.
set -eu
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
c++ -std=c++17 -Wall -Wextra -I .pio/libdeps/cyd/ArduinoJson/src -I src \
  test/byteco_test.cpp -o "$OUT/byteco_test"
"$OUT/byteco_test"
