#pragma once

// UI enqueues requests; the existing network worker fetches them without
// blocking animation or overlapping Drive's memory-heavy TLS connections.
namespace byteco {
enum class Mode { Motivation, Comfort, Distraction };
void begin();
bool request(Mode mode = Mode::Motivation);
void process();
bool take(char* phrase, unsigned size, bool& online);
}
