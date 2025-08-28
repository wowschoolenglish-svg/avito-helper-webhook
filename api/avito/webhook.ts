// pages/api/avito/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ВАЖНО: нужен сырой body, иначе подпись будет неверна
// + Явно просим Node-runtime, чтобы гарантированно работал node:crypto
export const config = {
  api: { bodyParser: false },
  runtime: 'nodejs' as const,
};

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''; // 5YwV9nqT8s2Kj0mZrX3cLpQh7dUaEf4B

function safeEqualHex(a: string, b: string) {
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b || '', 'hex'));
  } catch {
    return false;
  }
}

async function readRawBody(req: NextApiRequest): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    if (!WEBHOOK_SECRET) {
      console.error('WEBHOOK_SECRET is empty. Check Vercel env.');
      return res.status(500).json({ ok: false, error: 'Server misconfig' });
    }

    const raw = await readRawBody(req);
    const sig = (req.headers['x-avito-signature'] as string) || '';

    // HMAC-SHA256(raw, secret) -> hex
    const calc = createHmac('sha256', WEBHOOK_SECRET).update(raw, 'utf8').digest('hex');

    if (!safeEqualHex(calc, sig)) {
      console.warn('Signature mismatch', { got: sig, calc });
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.error('Bad JSON:', raw);
      return res.status(400).json({ ok: false, error: 'Bad JSON' });
    }

    const { event, payload } = body || {};
    console.log('AVITO_WEBHOOK', { node: process.version, event, preview: JSON.stringify(payload)?.slice(0, 300) });

    // TODO: здесь любая бизнес-логика

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    // Ключевое: чтобы в Vercel Logs был стек, иначе виден только FUNCTION_INVOCATION_FAILED
    console.error('HANDLER_CRASH', e?.stack || e?.message || e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}
