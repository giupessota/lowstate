// The weather where the screen is (GADGET_LAT/GADGET_LON in secrets.h), from
// Open-Meteo: free, no account. Fetched by the network task every 15
// minutes; read by the home screen.
#pragma once

#include <ctime>

namespace weather {

struct Now {
  bool has = false;
  int temperature = 0;  // °C, rounded
  int high = 0;
  int low = 0;
  int code = -1;        // WMO weather code
};

// Network task only. True when it got an answer.
bool fetch();
// Any task: the last answer.
Now current();

}  // namespace weather
