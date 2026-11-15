#!/usr/bin/env node
'use strict';
// Configure the local bridge without printing or embedding the OpenAI key.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const addresses = Object.values(os.networkInterfaces()).flat()
  .filter(item => item.family === 'IPv4' && !item.internal);
const host = process.argv[2] || addresses.find(item => item.address.startsWith('192.168.'))?.address
  || addresses[0]?.address;
if (!host || !/^[\w.-]+$/.test(host)) throw new Error('Supply the Mac LAN IP or hostname');
const token = process.env.BYTECO_DEVICE_TOKEN || crypto.randomBytes(32).toString('hex');
const url = `http://${host}:${process.env.BYTECO_PORT || 8787}`;
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (!/^BYTECO_DEVICE_TOKEN=/m.test(env)) env += `\nBYTECO_DEVICE_TOKEN=${token}\n`;
fs.writeFileSync(envPath, env, { mode: 0o600 });
const target = path.join(root, 'gadget/include/secrets.h');
let secrets = fs.readFileSync(target, 'utf8');
for (const [key, value] of Object.entries({ BYTECO_SERVER_URL: url, BYTECO_DEVICE_TOKEN: token })) {
  const line = `#define ${key} ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^#define ${key} .*`, 'm');
  secrets = pattern.test(secrets) ? secrets.replace(pattern, line) : `${secrets}\n${line}\n`;
}
fs.writeFileSync(target, secrets);
console.log(`Byteco configurado para ${url}. Chave OpenAI permanece somente no Mac.`);
