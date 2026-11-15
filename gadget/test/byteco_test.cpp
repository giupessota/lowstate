#include <cassert>
#include <iostream>
#include <string>
#include "byteco_protocol.h"
#include "byteco_prompts.h"

// Build provider fixtures without ever using a real API key.
static JsonDocument response(const std::string& text, const char* status = "completed") {
  JsonDocument doc;
  doc["status"] = status;
  doc["output"][0]["type"] = "message";
  doc["output"][0]["content"][0]["type"] = "output_text";
  doc["output"][0]["content"][0]["text"] = text;
  return doc;
}

int main() {
  char text[384] = "unchanged";
  auto doc = response("  Giu, café.\n Sarcasmo.  ");
  assert(byteco::extractPhrase(doc, text, sizeof(text)));
  assert(std::string(text) == "Giu, café. Sarcasmo.");
  for (const auto* status : {"incomplete", "failed", "in_progress"}) {
    doc = response("Do not show this.", status);
    assert(!byteco::extractPhrase(doc, text, sizeof(text)));
  }
  for (const std::string& invalid : {std::string(), std::string(121, 'x'),
       std::string("Bom dia 🚀"), std::string("wrong\x01"), std::string("\xc0\xaf")}) {
    doc = response(invalid);
    assert(!byteco::extractPhrase(doc, text, sizeof(text)));
  }
  std::string accents;
  for (int i = 0; i < 120; ++i) accents += "á";
  doc = response(accents);
  assert(byteco::extractPhrase(doc, text, sizeof(text)));
  assert(!byteco::extractPhrase(doc, text, 10));
  assert(!byteco::extractPhrase(doc, nullptr, sizeof(text)));
  accents += "á";
  doc = response(accents);
  assert(!byteco::extractPhrase(doc, text, sizeof(text)));
  doc = response("Café… e ‘paciência’. ");
  assert(byteco::extractPhrase(doc, text, sizeof(text)));
  doc["output"][0]["content"][0]["type"] = "refusal";
  assert(!byteco::extractPhrase(doc, text, sizeof(text)));
  doc = response("No tool output as speech");
  doc["output"][0]["type"] = "function_call";
  assert(!byteco::extractPhrase(doc, text, sizeof(text)));

  JsonDocument request;
  byteco::buildRequest(request, "test-model", byteco::PROMPTS[1]);
  assert(request["store"].is<bool>() && request["store"] == false);
  assert(request["max_output_tokens"] == 100);
  assert(request["model"] == "test-model");
  assert(request["api_key"].isNull());
  assert(request["previous_response_id"].isNull());
  assert(request["tools"].isNull());
  std::cout << "byteco: direct request and response validation passed\n";
}
