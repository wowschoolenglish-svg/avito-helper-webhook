import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { runtime: 'nodejs' as const };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('DIAG_HIT', { node: process.version, hasSecret: Boolean(process.env.WEBHOOK_SECRET) });
  res.status(200).json({
    ok: true,
    runtime: 'node',
    node: process.version,
    hasSecret: Boolean(process.env.WEBHOOK_SECRET),
  });
}
