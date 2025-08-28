// api/diag.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    method: req.method,
    url: req.url,
    // Секреты не светим — только флажок, что переменная задана
    env: {
      WEBHOOK_SECRET: Boolean(process.env.WEBHOOK_SECRET)
    }
  });
}
