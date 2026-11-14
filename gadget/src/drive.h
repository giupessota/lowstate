// Google Drive's hidden app folder, the same one the desktop app syncs
// through (desktop-google.cjs): the computers' files
// "lowstate-device-<device>.json", the agenda "lowstate-agenda.json", and
// this screen's own file, which it alone writes.
#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

#include <functional>
#include <string>

namespace drive {

enum class Result { Ok, NoNetwork, SignedOut, Failed };

struct Files {
  // Of all computers' files (this screen's included), the newest tasks and
  // categories — the value the app's sync would end up with.
  std::string items;
  std::string categories;
  int computers = 0;
  JsonDocument agenda;  // { events: [...] } or empty
  String ownId;         // this screen's file id, "" until written
};

// Reads what Lowstate keeps there, one file at a time, keeping only the
// newest tasks and categories (the screen has little memory).
Result readAll(Files& files);

// Memory set aside for Drive work (24 KB), emptied by this call. Free
// between readAll() calls: ticking parses the task list here so the shared
// heap stays whole for the TLS connection.
ArduinoJson::Allocator* scratch();

// Writes this screen's file (creates it the first time). `writeBody` writes
// the content; it is called twice — once to measure it, once to send it —
// so the content is never held whole in memory.
Result writeOwn(Files& files, const std::function<void(Print&)>& writeBody);

const char* describe(Result result);

}  // namespace drive
