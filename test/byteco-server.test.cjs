'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createBytecoServer, phraseFrom } = require('../scripts/byteco-server.cjs');

const token = 'test-device-token-with-enough-characters';
const completed = text => ({ status: 'completed', output: [{ type: 'message', content: [
  { type: 'output_text', text },
] }] });

async function withServer(options, run) {
  const server = createBytecoServer({ apiKey: 'test-key', token, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await run(url); } finally { await new Promise(resolve => server.close(resolve)); }
}

function ask(url, authorization = `Bearer ${token}`) {
  return fetch(`${url}/phrase`, { method: 'POST', headers: { authorization } });
}

test('unauthenticated requests never call OpenAI', async () => {
  let calls = 0;
  await withServer({ fetchImpl: async () => { calls++; } }, async url => {
    assert.equal((await ask(url, 'Bearer wrong')).status, 401);
    assert.equal(calls, 0);
  });
});

test('touch requests use Responses, no stored context, and a bounded reply', async () => {
  let calls = 0;
  let clock = 0;
  await withServer({ now: () => clock, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 100);
    assert.ok(!body.tools);
    assert.match(body.instructions, /Byteco/);
    return { ok: true, json: async () => completed('Seu passo pequeno ainda conta. Vai com calma.') };
  } }, async url => {
    const first = await ask(url);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).source, 'openai');
    assert.equal((await ask(url)).status, 429);
    assert.equal(calls, 1);
    clock = 10001;
    assert.equal((await ask(url)).status, 200);
  });
});

test('concurrent taps cannot start overlapping provider calls', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  await withServer({ cooldownMs: 0, fetchImpl: async () => {
    started(); await gate;
    return { ok: true, json: async () => completed('Vai com calma.') };
  } }, async url => {
    const pending = ask(url);
    await ready;
    assert.equal((await ask(url)).status, 429);
    release();
    assert.equal((await pending).status, 200);
  });
});

test('provider failures and malformed output become safe errors', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('secret-in-provider-error'); },
    async () => ({ ok: true, json: async () => completed('x'.repeat(121)) }),
    async () => ({ ok: true, json: async () => ({ status: 'incomplete', output: [] }) }),
  ]) {
    await withServer({ fetchImpl }, async url => {
      const response = await ask(url);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'phrase_unavailable' });
    });
  }
});

test('provider timeout releases the bridge for another request', async () => {
  await withServer({ cooldownMs: 0, timeoutMs: 20, fetchImpl: async (_, options) => {
    await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)));
  } }, async url => {
    assert.equal((await ask(url)).status, 503);
    assert.equal((await ask(url)).status, 503);
  });
});

test('only complete, short plain text is accepted', () => {
  assert.equal(phraseFrom(completed('  Um passo.\n Depois outro. ')), 'Um passo. Depois outro.');
  for (const text of ['', 'x'.repeat(121), 'Vai! 🚀']) assert.throws(() => phraseFrom(completed(text)));
});


test('each menu option uses its own fixed prompt', async () => {
  const prompts = [];
  await withServer({ cooldownMs: 0, fetchImpl: async (_, options) => {
    prompts.push(JSON.parse(options.body).instructions);
    return { ok: true, json: async () => completed('Um passo por vez.') };
  } }, async url => {
    for (const mode of ['motivation', 'comfort', 'distraction']) {
      const response = await fetch(`${url}/phrase?mode=${mode}`, {
        method: 'POST', headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
    }
  });
  assert.match(prompts[0], /motivacional irônico/);
  assert.match(prompts[1], /Acolha com gentileza/);
  assert.match(prompts[2], /pergunta imaginativa/);
  assert.equal(new Set(prompts).size, 3);
});

test('invalid modes never reach the provider', async () => {
  let calls = 0;
  await withServer({ fetchImpl: async () => { calls++; } }, async url => {
    for (const mode of ['custom-prompt', '__proto__', 'constructor']) {
      const response = await fetch(`${url}/phrase?mode=${mode}`, {
        method: 'POST', headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 400);
    }
    assert.equal(calls, 0);
  });
});
