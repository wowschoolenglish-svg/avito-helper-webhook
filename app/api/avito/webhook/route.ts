// app/api/avito/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

// === Обязательные переменные окружения ===
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const AVITO_USER_ID = process.env.AVITO_USER_ID || ""; // 407257314
const AVITO_CLIENT_ID = process.env.AVITO_CLIENT_ID || "";
const AVITO_CLIENT_SECRET = process.env.AVITO_CLIENT_SECRET || "";

// === OAuth-токены (инициализируем из .env; свежие будем хранить в памяти рантайма) ===
let ACCESS_TOKEN = process.env.AVITO_AUTH_ACCESS_TOKEN || "";
let REFRESH_TOKEN = process.env.AVITO_AUTH_REFRESH_TOKEN || "";

/* ====================== УТИЛИТЫ ====================== */

function verifySignature(raw: string, given: string) {
  if (!WEBHOOK_SECRET) return true; // на случай, если забыли выставить в env
  const calc = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return calc === (given || "").toLowerCase();
}

async function refreshToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: REFRESH_TOKEN,
    client_id: AVITO_CLIENT_ID,
    client_secret: AVITO_CLIENT_SECRET,
  });

  const r = await fetch("https://api.avito.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = await r.json();

  if (!r.ok) throw new Error(`Refresh failed: ${r.status} ${JSON.stringify(j)}`);

  ACCESS_TOKEN = j.access_token || "";
  if (j.refresh_token) REFRESH_TOKEN = j.refresh_token;

  return ACCESS_TOKEN;
}

async function ensureAccessToken() {
  if (!ACCESS_TOKEN) return await refreshToken();
  return ACCESS_TOKEN;
}

function extractIncomingText(payload: any) {
  const chatId = payload?.chat_id;
  const msg = payload?.message ?? payload;
  const direction = msg?.direction ?? payload?.direction;
  const text =
    msg?.text ?? msg?.content?.text ?? payload?.text ?? payload?.content?.text;

  return { chatId, text, direction };
}

async function askOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Фолбэк, если ключ OpenAI не задан — отвечаем вежливо и коротко
    return "Спасибо за сообщение! Расскажите, пожалуйста, что именно вас интересует 😊";
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — вежливый ассистент WOW-School. Отвечай кратко (1–2 предложения), по делу.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const j = await r.json();
  if (!r.ok) throw new Error(`OpenAI error: ${r.status} ${JSON.stringify(j)}`);

  return j?.choices?.[0]?.message?.content?.trim() || "Спасибо! ✨";
}

async function sendAvitoMessage(accessToken: string, chatId: string, text: string) {
  const url = `https://api.avito.ru/messenger/v1/accounts/${AVITO_USER_ID}/chats/${encodeURIComponent(
    chatId
  )}/messages`;

  const body = JSON.stringify({ message: { type: "text", text } });

  const doSend = async (token: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

  // первая попытка
  let resp = await doSend(accessToken);

  // если токен протух — обновляем и пробуем ещё раз
  if (resp.status === 401 || resp.status === 403) {
    const fresh = await refreshToken();
    resp = await doSend(fresh);
  }

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`send failed: ${resp.status} ${t}`);
  }

  return resp.json();
}

/* ====================== ХЕНДЛЕРЫ ====================== */

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-avito-signature") || "";

  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  // Пинг от Авито — чтобы проверить доступность урла
  if (body?.event === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  if (body?.event !== "message") {
    // другие типы событий тут игнорируем
    return NextResponse.json({ ok: true, skip: "not a message" });
  }

  const { chatId, text, direction } = extractIncomingText(body?.payload);
  if (!chatId) {
    return NextResponse.json({ ok: false, error: "no chat_id" }, { status: 400 });
  }
  if (direction && direction !== "in") {
    // Отвечаем только на входящие
    return NextResponse.json({ ok: true, skip: "outgoing" });
  }
  if (!text) {
    return NextResponse.json({ ok: true, skip: "no-text" });
  }

  try {
    const reply = await askOpenAI(text);
    const token = await ensureAccessToken();
    await sendAvitoMessage(token, chatId, reply);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("AVITO_WEBHOOK_ERROR:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Авито может иногда "пробрасывать" GET — всегда отвечаем 405
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
