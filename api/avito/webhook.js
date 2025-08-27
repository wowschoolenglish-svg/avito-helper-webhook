// api/avito/webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Простейшая проверка секрета (совпадает с тем, что вы уже задали в Vercel env: WEBHOOK_SECRET)
  const secret = process.env.WEBHOOK_SECRET || '';
  const auth = req.headers['x-webhook-secret'] || req.headers['x-avito-webhook-secret'];
  if (secret && auth !== secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // Читаем тело
  let payload = {};
  try {
    payload = req.body && Object.keys(req.body).length ? req.body : await parseJson(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  // Здесь можно сделать что угодно: отправить в Telegram, в логгер и т.п.
  // Сейчас просто ответим 200, чтобы Авито видело успешный хук.
  // !!! Память у serverless не постоянная — в файл на Vercel лог не сохраняем.
  return res.status(200).json({ ok: true });
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
