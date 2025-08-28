// pages/api/avito/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// читаем "сырой" body - нужен для HMAC
function readRaw(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const secret = process.env.WEBHOOK_SECRET || "";
    const raw    = await readRaw(req);
    const got    = String(req.headers["x-avito-signature"] || "");
    const calc   = crypto.createHmac("sha256", secret).update(raw).digest("hex");

    if (!secret || !got || got !== calc) {
      console.warn("Signature mismatch", { got, calc });
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const body = JSON.parse(raw.toString("utf8"));
    console.log("AVITO_WEBHOOK", { event: body?.event, ts: new Date().toISOString() });

    // TODO: ваша логика обработки события
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("Webhook error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
