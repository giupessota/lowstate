#!/usr/bin/env node
'use strict';
// Create local OTA authentication without displaying the password.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const password = process.env.BYTECO_OTA_PASSWORD || crypto.randomBytes(24).toString('hex');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (!/^BYTECO_OTA_PASSWORD=/m.test(env)) env += `\nBYTECO_OTA_PASSWORD=${password}\n`;
fs.writeFileSync(envPath, env, { mode: 0o600 });
const target = path.join(root, 'gadget/include/ota_secrets.h');
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing symlink');
const hash = crypto.createHash('sha256').update(password).digest('hex');
fs.writeFileSync(target, `// Local OTA authentication. Never commit.\n#pragma once\n#define GADGET_OTA_PASSWORD_HASH "${hash}"\n`, { mode: 0o600 });
console.log('OTA password configured locally; only its hash is embedded.');
