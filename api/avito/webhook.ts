// api/avito/webhook.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

// Читаем "сырое" тело запроса, чтобы HMAC совпал 1:1 с тем, что подписывал Авито
async function readRawBody(req: VercelRequest): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) {
      console.error('WEBHOOK_SECRET is not set');
      return res.status(500).json({ ok: false, error: 'Misconfigured: no WEBHOOK_SECRET' });
    }

    const raw = await readRawBody(req);
    const receivedSig = (req.headers['x-avito-signature'] as string) || '';

    if (!receivedSig) {
      console.warn('Missing X-Avito-Signature header');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const calc = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    const a = Buffer.from(receivedSig, 'hex');
    const b = Buffer.from(calc, 'hex');

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.warn('Signature mismatch', { receivedSig, calc, raw });
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Подпись валидна — можно парсить JSON
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* игнор */ }

    console.log('AVITO_WEBHOOK | event=', body?.event);

    // Обязательный быстрый 200, иначе Авито будет ретраить:
    if (body?.event === 'ping') return res.json({ ok: true });

    if (body?.event === 'message') {
      // Здесь твоя логика (сейчас просто логируем и говорим "ок")
      // body.payload.chat_id, body.payload.message.text и т.д.
      return res.json({ ok: true });
    }

    // На всякий случай — отвечаем 200 на прочие события
    return res.json({ ok: true });
  } catch (err) {
    console.error('Webhook fatal error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
