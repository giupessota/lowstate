#pragma once

#include <ArduinoJson.h>
#include <cstring>
#include <string>

namespace byteco {

// Build a short, stateless Responses API request without patient/planner data.
inline void buildRequest(JsonDocument& doc, const char* model, const char* prompt) {
  doc["model"] = model;
  doc["instructions"] = prompt;
  doc["input"] = "Sua próxima fala para Giu:";
  doc["max_output_tokens"] = 100;
  doc["store"] = false;
}

// Accept only complete, short text renderable by the screen's Latin fonts.
inline bool extractPhrase(JsonDocument& doc, char* output, size_t capacity) {
  if (!output || capacity == 0 || strcmp(doc["status"] | "", "completed") != 0) return false;
  std::string phrase;
  for (JsonObjectConst item : doc["output"].as<JsonArrayConst>()) {
    if (strcmp(item["type"] | "", "message") != 0) continue;
    for (JsonObjectConst part : item["content"].as<JsonArrayConst>()) {
      if (strcmp(part["type"] | "", "output_text") != 0) continue;
      if (!phrase.empty()) phrase += ' ';
      phrase += part["text"] | "";
    }
  }
  // Collapse whitespace before counting characters, without splitting UTF-8.
  std::string clean;
  bool space = false;
  for (unsigned char ch : phrase) {
    if (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n') {
      if (!clean.empty()) space = true;
    } else {
      if (space) clean += ' ';
      clean += static_cast<char>(ch);
      space = false;
    }
  }
  if (clean.empty() || clean.size() >= capacity) return false;
  size_t count = 0;
  for (size_t i = 0; i < clean.size();) {
    const auto ch = static_cast<unsigned char>(clean[i++]);
    unsigned code = ch;
    unsigned continuation = 0;
    if (ch >= 0xC2 && ch <= 0xDF) { code &= 0x1F; continuation = 1; }
    else if (ch >= 0xE0 && ch <= 0xEF) { code &= 0x0F; continuation = 2; }
    else if (ch >= 0x80) return false;
    const unsigned minimum = continuation == 2 ? 0x800 : continuation == 1 ? 0x80 : 0;
    while (continuation--) {
      if (i == clean.size()) return false;
      const auto next = static_cast<unsigned char>(clean[i++]);
      if ((next & 0xC0) != 0x80) return false;
      code = (code << 6) | (next & 0x3F);
    }
    const bool punctuation = code == 0x2013 || code == 0x2014 || code == 0x2018 || code == 0x2019 ||
                             code == 0x201C || code == 0x201D || code == 0x2022 || code == 0x2026;
    if (code < minimum || !((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || punctuation)) return false;
    if (++count > 120) return false;
  }
  std::memcpy(output, clean.c_str(), clean.size() + 1);
  return true;
}
}  // namespace byteco
