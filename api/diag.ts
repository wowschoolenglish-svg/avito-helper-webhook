export const config = { runtime: 'nodejs' as const };

export default async function handler(req: any, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    kind: 'vercel-function',
    node: process.version,
    hasSecret: !!process.env.WEBHOOK_SECRET,
  }));
}
