// pages/api/avito/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// Нужен «сырой» body для расчёта HMAC
export const config = {
  api: { bodyParser: false },
};

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''; // у вас: 5YwV9nqT8s2Kj0mZrX3cLpQh7dUaEf4B

function timingSafeEqualHex(a: string, b: string) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b || '', 'hex'));
  } catch {
    return false;
  }
}

async function readRawBody(req: NextApiRequest): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const raw = await readRawBody(req);
  const sig = (req.headers['x-avito-signature'] as string) || '';

  // Проверяем подпись HMAC-SHA256(raw, WEBHOOK_SECRET) -> hex
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is empty');
    return res.status(500).json({ ok: false, error: 'Server misconfig' });
  }
  const calc = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw, 'utf8').digest('hex');

  if (!timingSafeEqualHex(calc, sig)) {
    console.warn('Signature mismatch', { got: sig, calc });
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // Разбираем JSON после успешной валидации
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return res.status(400).json({ ok: false, error: 'Bad JSON' });
  }

  const { event, payload } = body || {};
  console.log('AVITO_WEBHOOK | event=', event, '| preview=', JSON.stringify(payload)?.slice(0, 300));

  // Здесь можно добавить любую логику обработки событий
  // ...

  return res.status(200).json({ ok: true });
}
