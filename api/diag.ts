// api/diag.js
export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    ts: new Date().toISOString(),
    method: req.method,
    url: req.url,
    env: { WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET }
  }));
}
