// What scripts/lowstate-gadget.cjs writes to secrets.h (not committed).
// Run the script instead of filling this by hand: it signs the screen in with
// Google and fills everything but the Wi-Fi.
#pragma once

#define WIFI_SSID "your-wifi"
#define WIFI_PASSWORD "your-wifi-password"

#define GOOGLE_CLIENT_ID "....apps.googleusercontent.com"
#define GOOGLE_CLIENT_SECRET "..."
#define GOOGLE_REFRESH_TOKEN "..."

#define GADGET_DEVICE "gadget-1a2b3c4d"
#define GADGET_NAME "Telinha"

#define GADGET_TZ "<-03>3"
#define GADGET_PLACE "PAULÍNIA"
#define GADGET_LAT -22.76111
#define GADGET_LON -47.15417
