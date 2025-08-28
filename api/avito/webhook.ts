import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { runtime: 'nodejs' as const };

function readRaw(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

function eqHex(a: string, b: string) {
  try { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b || '', 'hex')); }
  catch { return false; }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end(JSON.stringify({ ok:false, error:'Method Not Allowed' }));
      return;
    }

    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) {
      console.error('WEBHOOK_SECRET is empty');
      res.statusCode = 500;
      res.end(JSON.stringify({ ok:false, error:'Server misconfig' }));
      return;
    }

    const raw  = await readRaw(req);
    const sig  = (req.headers['x-avito-signature'] as string) || '';
    const calc = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

    if (!eqHex(calc, sig)) {
      console.warn('Signature mismatch', { got:sig, calc });
      res.statusCode = 401;
      res.end(JSON.stringify({ ok:false, error:'Unauthorized' }));
      return;
    }

    let body: any;
    try { body = JSON.parse(raw); }
    catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok:false, error:'Bad JSON' }));
      return;
    }

    const { event } = body || {};
    console.log('AVITO_WEBHOOK', { event });

    res.statusCode = 200;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({ ok:true }));
  } catch (e: any) {
    console.error('HANDLER_CRASH', e?.stack || e?.message || e);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok:false, error:'internal' }));
  }
}
