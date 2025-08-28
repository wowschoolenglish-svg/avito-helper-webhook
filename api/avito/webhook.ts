// api/avito/webhook.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

/** Читаем сырое тело запроса (важно для HMAC) */
function getRawBody(req: VercelRequest) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const raw = await getRawBody(req);
    const secret = process.env.WEBHOOK_SECRET || '';
    const got = String(req.headers['x-avito-signature'] || '');

    // вычисляем HMAC по СЫРОМУ телу
    const calc = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    if (!secret || got !== calc) {
      res.status(401).json({ ok: false, error: 'Signature mismatch', got, calc });
      return;
    }

    // парсим уже после проверки подписи
    const body = JSON.parse(raw.toString('utf8'));
    const event = body?.event;

    console.log('AVITO_WEBHOOK', { event });

    if (event === 'ping') {
      res.status(200).json({ ok: true, pong: Date.now() });
      return;
    }

    // здесь твоя бизнес-логика (message и т.п.)
    res.status(200).json({ ok: true, received: event });
  } catch (e: any) {
    console.error('WEBHOOK_ERROR', e);
    res.status(500).json({ ok: false, error: e?.message || 'internal' });
  }
}
