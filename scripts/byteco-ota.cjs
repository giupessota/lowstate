#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
process.loadEnvFile(path.join(root, '.env.local'));
const password = process.env.BYTECO_OTA_PASSWORD;
if (!password) throw new Error('Run node scripts/byteco-ota-setup.cjs first, then bootstrap via USB');
const host = process.argv[2] || 'byteco.local';
const build = spawnSync('pio', ['run', '-d', path.join(root, 'gadget')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const binary = path.join(root, 'gadget/.pio/build/cyd/firmware.bin');
// Partition sizes are a hard limit, including binary headers and padding.
if (fs.statSync(binary).size > 0x1F0000) throw new Error('Firmware exceeds the OTA slot');
const core = process.env.PLATFORMIO_CORE_DIR || path.join(os.homedir(), '.platformio');
const uploader = path.join(core, 'packages/framework-arduinoespressif32/tools/espota.py');
console.log('On the screen, hold the clock for 2 s to turn on update mode (5 minutes).');
// The board's PBKDF2 authentication is slow: give the uploader 30 s per step.
console.log(`Uploading to ${host} over Wi-Fi...`);
const result = spawnSync('python3', [uploader, '-i', host, '-p', '3232', '-a', password, '-f', binary, '-t', '30'], { encoding: 'utf8' });
// Never expose the password if an uploader happens to include it in diagnostics.
for (const output of [result.stdout, result.stderr]) if (output) process.stdout.write(output.split(password).join('[redacted]'));
if (result.error) console.error('Could not start the OTA uploader');
process.exitCode = result.status === 0 ? 0 : (result.status || 1);
