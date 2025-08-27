// app/api/avito/webhook/route.ts
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Пример: просто читаем body и отвечаем 200
    const raw = await req.text();
    console.log("AVITO_WEBHOOK:", raw);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Запретим GET, чтобы Avito не ретраил GET-запросы
export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
