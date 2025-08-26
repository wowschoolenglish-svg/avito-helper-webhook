export default function handler(req, res) {
  res.status(200).json({
    AVITO_CLIENT_ID: process.env.AVITO_CLIENT_ID ? "✅ есть" : "❌ нет",
    AVITO_CLIENT_SECRET: process.env.AVITO_CLIENT_SECRET ? "✅ есть" : "❌ нет",
    AVITO_USER_ID: process.env.AVITO_USER_ID || "❌ нет",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ? "✅ есть" : "❌ нет",
  });
}
