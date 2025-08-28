// api/diag.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    ok: true,
    route: '/api/diag',
    method: req.method,
    now: new Date().toISOString(),
    headers: req.headers,
  });
}
