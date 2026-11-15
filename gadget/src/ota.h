#pragma once
// Firmware updates over Wi-Fi, only on request: ArduinoOTA and mDNS
// (byteco.local) take ~12 KB of heap while listening, which the TLS
// connections to Google need, so they run only in "update mode" — turned on
// by holding the home screen's clock (or USB command u) and off again after
// five minutes, when tapped, or once an update fails.
namespace ota {
// UI thread.
void poll();
void enable();
void disable();
// Any thread: update mode is on (the network worker pauses meanwhile).
bool active();
}
