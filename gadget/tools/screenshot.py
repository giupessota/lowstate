#!/usr/bin/env python3
"""Screenshot of the desk screen over USB, as a PNG (no extra packages).
The board draws the screen again and sends the pixels as LVGL made them.

    python3 gadget/tools/screenshot.py out.png [keys] [--port /dev/cu.usbserial-1140]

`keys` are sent first to move around (see main.cpp serialCommands):
h = home, 1..9 = open that tool, t = open the first task's card, b = close it.
Example: screenshot.py lowstate-card.png 1t
"""
import fcntl
import glob
import os
import struct
import sys
import termios
import time
import zlib

W, H = 320, 240


def open_port(path):
    fd = os.open(path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    attrs = termios.tcgetattr(fd)
    attrs[4] = attrs[5] = termios.B115200
    attrs[2] |= termios.CLOCAL | termios.CREAD
    attrs[3] = 0
    termios.tcsetattr(fd, termios.TCSANOW, attrs)
    # DTR and RTS both low: the board's auto-reset circuit leaves it running.
    fcntl.ioctl(fd, 0x8004746B, struct.pack("I", 0x006))  # TIOCMBIC
    return fd


def read_exact(fd, count, timeout=30):
    data = b""
    start = time.time()
    while len(data) < count:
        if time.time() - start > timeout:
            raise SystemExit(f"timed out ({len(data)}/{count} bytes)")
        try:
            data += os.read(fd, count - len(data))
        except BlockingIOError:
            time.sleep(0.01)
    return data


def read_until(fd, marker, timeout=10):
    data = b""
    start = time.time()
    while marker not in data:
        if time.time() - start > timeout:
            raise SystemExit("no answer from the board")
        try:
            data += os.read(fd, 4096)
        except BlockingIOError:
            time.sleep(0.01)
    return data[data.index(marker) + len(marker):]


def png(path, rgb):
    rows = b"".join(b"\x00" + rgb[y * W * 3:(y + 1) * W * 3] for y in range(H))
    chunk = lambda kind, body: struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    with open(path, "wb") as out:
        out.write(b"\x89PNG\r\n\x1a\n")
        out.write(chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)))
        out.write(chunk(b"IDAT", zlib.compress(rows, 9)))
        out.write(chunk(b"IEND", b""))


def main():
    args = [a for a in sys.argv[1:]]
    port = None
    if "--port" in args:
        port = args[args.index("--port") + 1]
        del args[args.index("--port"):args.index("--port") + 2]
    if not args:
        raise SystemExit(__doc__)
    out, keys = args[0], (args[1] if len(args) > 1 else "")
    port = port or (glob.glob("/dev/cu.usbserial*") or glob.glob("/dev/cu.wchusbserial*") or [None])[0]
    if not port:
        raise SystemExit("board not found on USB")

    fd = open_port(port)
    for key in keys:
        os.write(fd, key.encode())
        time.sleep(0.6)  # screen animations
    time.sleep(0.4)
    termios.tcflush(fd, termios.TCIFLUSH)
    os.write(fd, b"s")
    data = read_until(fd, b"SHOT 320 240\n")
    rgb = bytearray(W * H * 3)
    while True:
        while b"\n" not in data:
            data += read_exact(fd, 1)
        line, data = data.split(b"\n", 1)
        line = line.strip()
        if line == b"END":
            break
        if not line.startswith(b"AREA"):
            continue
        x1, y1, x2, y2 = map(int, line.split()[1:])
        size = (x2 - x1 + 1) * (y2 - y1 + 1) * 2
        if len(data) < size:
            data += read_exact(fd, size - len(data))
        pixels, data = data[:size], data[size:]
        i = 0
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                value = pixels[i] | pixels[i + 1] << 8  # RGB565 as the ESP32 keeps it (low byte first)
                i += 2
                r, g, b = (value >> 11) & 0x1F, (value >> 5) & 0x3F, value & 0x1F
                o = (y * W + x) * 3
                rgb[o:o + 3] = bytes(((r * 527 + 23) >> 6, (g * 259 + 33) >> 6, (b * 527 + 23) >> 6))
    png(out, bytes(rgb))
    print(out)


if __name__ == "__main__":
    main()
