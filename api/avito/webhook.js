// api/avito/webhook.js
import { createHmac, timingSafeEqual } from 'node:crypto';

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) {
      console.error('WEBHOOK_SECRET is not set');
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: 'Misconfigured: no WEBHOOK_SECRET' }));
    }

    const raw = await readRawBody(req);
    const received = req.headers['x-avito-signature'] || '';

    if (!received) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }

    const calc = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(calc, 'hex');

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.warn('Signature mismatch', { received, calc });
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }

    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}

    console.log('AVITO_WEBHOOK | event=', body?.event);

    // Отвечаем мгновенно, чтобы Авито не ретраило
    if (body?.event === 'ping') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true }));
    }

    if (body?.event === 'message') {
      // здесь твоя логика обработки
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true }));
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error('Webhook fatal error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
  }
}
