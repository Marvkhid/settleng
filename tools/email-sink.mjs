import { createServer } from 'node:http';

/**
 * A local stand-in for the Resend API so reminder delivery can be verified end to end without
 * spamming a real inbox. It accepts the same POST /emails body SettleNG sends and records it.
 *
 * Control endpoints:
 *   GET  /__log   -> every message received
 *   POST /__fail  -> {"times": n} make the next n sends return HTTP 500
 *   POST /__reset -> clear the log and the failure counter
 */
const messages = [];
let failNext = 0;

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/__log' && req.method === 'GET') return send(200, { count: messages.length, messages });
    if (req.url === '/__reset' && req.method === 'POST') {
      messages.length = 0;
      failNext = 0;
      return send(200, { ok: true });
    }
    if (req.url === '/__fail' && req.method === 'POST') {
      try {
        failNext = Number(JSON.parse(raw || '{}').times ?? 1) || 1;
      } catch {
        failNext = 1;
      }
      return send(200, { failNext });
    }
    if (req.url === '/emails' && req.method === 'POST') {
      if (failNext > 0) {
        failNext--;
        return send(500, { message: 'sink failure requested' });
      }
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return send(400, { message: 'bad json' });
      }
      const id = `sink_${messages.length + 1}_${Date.now()}`;
      messages.push({ id, to: body.to, subject: body.subject, text: body.text, html: body.html, receivedAt: new Date().toISOString() });
      console.log(`sink: accepted "${body.subject}" for ${JSON.stringify(body.to)}`);
      return send(200, { id });
    }
    send(404, { message: 'not found' });
  });
});

server.listen(4100, '127.0.0.1', () => console.log('email sink listening on 4100'));
