// pages/api/avito/webhook.js
import crypto from "crypto";
import fs from "fs/promises";

// Для проверки подписи нужен "сырой" (raw) body.
// В API-роутах Next.js так отключаем стандартный bodyParser.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Читаем "сырой" body из запроса (Buffer)
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    // Простой ping эндпоинта браузером
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, info: "Avito webhook is ready" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error("WEBHOOK_SECRET is not set in env");
      return res.status(500).json({ ok: false, error: "Server misconfigured" });
    }

    // 1) Сырой body
    const raw = await readRawBody(req);

    // 2) Подпись от Авито
    const signature =
      req.headers["x-avito-signature"] ||
      req.headers["X-Avito-Signature"] ||
      "";

    // 3) Считаем HMAC по сырому body
    const mySig = crypto.createHmac("sha256", secret).update(raw).digest("hex");

    if (!signature || signature !== mySig) {
      console.warn("Signature mismatch", { got: signature, calc: mySig });
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 4) Теперь можно парсить JSON
    let body;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch (e) {
      console.error("Invalid JSON", e);
      return res.status(400).json({ ok: false, error: "Bad JSON" });
    }

    // 5) Логируем в Vercel Logs
    console.log("AVITO_WEBHOOK", {
      ts: new Date().toISOString(),
      headers: {
        "content-type": req.headers["content-type"],
        "x-avito-signature": signature,
        "user-agent": req.headers["user-agent"],
      },
      body,
    });

    // 6) Доп. отладка: пытаемся писать во временный файл (не постоянно)
    try {
      await fs.appendFile(
        "/tmp/avito-messages.log",
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            headers: {
              "content-type": req.headers["content-type"],
              "x-avito-signature": signature,
              "user-agent": req.headers["user-agent"],
            },
            body,
          },
          null,
          2
        ) + "\n",
        "utf8"
      );
    } catch (e) {
      // На Vercel это не гарантируется, поэтому просто логируем
      console.warn("append /tmp failed:", e?.message);
    }

    // 7) Ответ ОК — важно для Авито
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
