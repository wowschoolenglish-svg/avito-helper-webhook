// app/api/avito/webhook/route.ts  (Next.js App Router)
import crypto from "crypto";

export const runtime = "edge"; // быстрее и дешевле
export const preferredRegion = "fra1"; // по желанию

function signOk() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function unauthorized(msg: string) {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized", msg }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AVITO_CLIENT_ID!,
    client_secret: process.env.AVITO_CLIENT_SECRET!,
  });
  const r = await fetch("https://api.avito.ru/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const j = await r.json<any>();
  if (!r.ok || !j.access_token) {
    throw new Error(`token fail ${r.status}: ${JSON.stringify(j)}`);
  }
  return j.access_token;
}

async function sendMessage(chatId: string, text: string, token: string) {
  const url = `https://api.avito.ru/messenger/v1/accounts/${process.env.AVITO_USER_ID}/chats/${chatId}/messages`;
  const payload = { type: "text", message: { text } };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`send fail ${r.status}: ${t}`);
  }
}

async function buildReplyText(question: string) {
  // Лёгкий «умный» шаблон без внешних библиотек (чтобы не ждать установку):
  // при желании подключим OpenAI официально через SDK.
  // Здесь — простой хардкод-скрипт (быстро и стабильно):
  const base =
    "Мы — онлайн-школа WOW School. Форматы: индивидуально 700₽/60 мин, парно 470₽/45 мин, группа 290₽/45 мин. Есть бесплатное пробное занятие. Напишите возраст/уровень и удобное время – подберём преподавателя.";
  // Можно чуть адаптировать под вопрос:
  if (/цена|стоим|сколько/i.test(question)) return base;
  if (/пробн/i.test(question)) return "Да, пробное бесплатное 😊 Когда удобно — днём или вечером? Сколько вам лет и какой уровень примерно?";
  if (/дет/i.test(question)) return "С детьми от 7 лет работаем регулярно. Есть добрые преподаватели, урок 45 мин. Удобно днём или вечером? Возраст ребёнка?";
  return base;
}

export async function POST(req: Request) {
  // 1) Проверяем подпись (как ты делал в PowerShell)
  const secret = process.env.WEBHOOK_SECRET || "";
  const raw = await req.text();
  const sig = req.headers.get("x-avito-signature") || "";
  const my = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!secret || sig.toLowerCase() !== my) {
    return unauthorized("bad signature");
  }

  // 2) Парсим событие
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad JSON" }), { status: 400 });
  }

  // 3) Разруливаем ping
  if (body?.event === "ping") return signOk();

  // 4) Автоответ только на входящие тексты
  if (body?.event === "message") {
    const chatId = body?.payload?.chat_id;
    const msg = body?.payload?.message;
    const isIncoming = msg?.direction === "in";
    const text = msg?.text || msg?.content?.text || "";

    // safety guard
    if (chatId && isIncoming && typeof text === "string" && text.trim()) {
      try {
        const reply = await buildReplyText(text);
        const token = await getAccessToken();
        await sendMessage(chatId, reply, token);
      } catch (e: any) {
        // логируем в ответ, чтобы видеть в Vercel Logs
        return new Response(JSON.stringify({ ok: false, error: String(e) }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }
    return signOk();
  }

  // По умолчанию — ок
  return signOk();
}
