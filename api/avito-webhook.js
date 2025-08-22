export default async function handler(req, res) {
  if (req.method === 'POST') {
    // TODO: проверить подпись/ID (когда дадут боевые ключи)
    return res.status(200).json({ ok: true });
  }
  return res.status(200).send('OK');
}
