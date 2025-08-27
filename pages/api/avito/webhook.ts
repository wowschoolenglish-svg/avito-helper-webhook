// pages/api/avito/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    console.log("AVITO_WEBHOOK:", raw);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal" });
  }
}
