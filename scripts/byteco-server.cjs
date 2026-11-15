#!/usr/bin/env node
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');

const INSTRUCTIONS = `Você é Byteco: robô bege de olhos sonolentos, café na mão e paciência em manutenção.
Sua marca é humor ácido: sarcasmo inteligente, ironia mordaz e uma conclusão engraçada e inesperada.
Fale como um amigo debochado, não como coach, terapeuta ou atendimento ao cliente.
Evite frases genéricas de autoajuda, positividade açucarada e repetir a mesma piada de café.
Pode provocar de leve; mire principalmente no absurdo da vida, burocracia e produtividade performática.
Não use crueldade pessoal, preconceito, ameaças ou humilhação. O afeto fica no subtexto.
Responda em português brasileiro. No máximo 100 caracteres, uma frase curta.
Sem emojis, aspas, hashtags ou introdução. Não invente fatos sobre Giu.
Não mencione inteligência artificial, botões, opções, escolhas de menu ou o pedido recebido.
Crie uma frase nova, não copie os exemplos.`;
const MODES = {
  motivation: 'Diga um incentivo motivacional irônico e ácido, com uma alfinetada e um empurrão para agir. Tom de exemplo: Seu potencial é enorme. Uma pena que não executa sozinho.',
  comfort: 'Giu disse que está difícil. Acolha com gentileza implícita e humor ácido contra o caos da vida, sem minimizar o sentimento ou dar conselhos clínicos. Tom de exemplo: Você não está quebrada. O sistema é que veio sem suporte técnico.',
  distraction: 'Distraia Giu com uma pergunta imaginativa, absurda e de humor ácido, com uma boa alfinetada no cotidiano. Não faça afirmações factuais ou dê tarefas de trabalho. Tom de exemplo: Se reunião desse XP, você já era chefona ou só um NPC em sofrimento?',
};

/** Extract one complete, displayable phrase from a Responses API result. */
function phraseFrom(result) {
  if (result.status !== 'completed') throw new Error('incomplete_response');
  const text = (result.output || []).filter(item => item.type === 'message')
    .flatMap(item => item.content || []).filter(part => part.type === 'output_text')
    .map(part => part.text).join(' ').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text || [...text].length > 120 || /[\p{Cs}\p{So}]/u.test(text)) throw new Error('invalid_phrase');
  return text;
}

/** Create the authenticated LAN bridge; only fixed prompts reach OpenAI. */
function createBytecoServer({ apiKey, token, model = 'gpt-4.1-mini', fetchImpl = fetch,
  now = Date.now, cooldownMs = 10000, timeoutMs = 15000 } = {}) {
  if (!apiKey || !token || token.length < 24) throw new Error('Missing API key or device token');
  let busy = false;
  let last = -Infinity;
  const expected = Buffer.from(`Bearer ${token}`);
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      send(401, { error: 'unauthorized' }); return;
    }
    if (req.url === '/health' && req.method === 'GET') { send(200, { ok: true }); return; }
    const url = new URL(req.url, 'http://byteco.local');
    if (url.pathname !== '/phrase' || req.method !== 'POST') { send(404, { error: 'not_found' }); return; }
    const mode = url.searchParams.get('mode') || 'motivation';
    if (!Object.hasOwn(MODES, mode)) { send(400, { error: 'invalid_mode' }); return; }
    // No task titles, calendar details or user-supplied prompts leave the gadget.
    req.resume();
    if (busy || now() - last < cooldownMs) { send(429, { error: 'cooldown' }); return; }
    busy = true;
    last = now();
    try {
      const response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ model, instructions: `${INSTRUCTIONS}\n${MODES[mode]}`, 
          input: 'Sua próxima fala para Giu:',
          max_output_tokens: 100, store: false }),
      });
      if (!response.ok) {
        // Log only HTTP status; provider error bodies can contain sensitive metadata.
        console.error(`Byteco: OpenAI HTTP ${response.status}`);
        send(502, { error: 'provider_unavailable' });
      } else {
        send(200, { phrase: phraseFrom(await response.json()), source: 'openai' });
      }
    } catch {
      send(503, { error: 'phrase_unavailable' });
    } finally {
      busy = false;
    }
  });
}

if (require.main === module) {
  const path = require('node:path');
  try { process.loadEnvFile(path.join(__dirname, '..', '.env.local')); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const port = Number(process.env.BYTECO_PORT || 8787);
  const server = createBytecoServer({ apiKey: process.env.OPENAI_API_KEY,
    token: process.env.BYTECO_DEVICE_TOKEN, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' });
  server.listen(port, process.env.BYTECO_HOST || '0.0.0.0', () => {
    console.log(`Byteco pronto na porta ${port}. Mantenha este processo aberto para as frases.`);
  });
  server.on('error', error => { console.error(`Byteco: ${error.code}`); process.exitCode = 1; });
}

module.exports = { createBytecoServer, phraseFrom, INSTRUCTIONS, MODES };
