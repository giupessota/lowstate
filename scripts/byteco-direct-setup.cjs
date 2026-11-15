#!/usr/bin/env node
'use strict';
// Run only after confirming that the existing key may be embedded in firmware.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(root, '.env.local')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is not configured');
const target = path.join(root, 'gadget/include/byteco_secrets.h');
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing symlink');
const content = '// Local only. Contains a secret embedded in the device firmware. Never commit.\n#pragma once\n'
  + `#define OPENAI_API_KEY ${JSON.stringify(process.env.OPENAI_API_KEY.trim())}\n`
  + `#define BYTECO_OPENAI_MODEL ${JSON.stringify(process.env.OPENAI_MODEL || 'gpt-4.1-mini')}\n`;
fs.writeFileSync(target, content, { mode: 0o600 });
fs.chmodSync(target, 0o600);
console.log('Byteco direct access configured in ignored gadget/include/byteco_secrets.h. No key printed.');
