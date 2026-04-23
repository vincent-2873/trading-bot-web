/**
 * LINE Webhook 處理器
 * 處理用戶傳來的訊息（來自 Rich Menu 或手動輸入）
 *
 * 記得在 LINE Developer Console 設定 Webhook URL:
 * https://trading-bot-web.zeabur.app/api/line/webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

const LINE_TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://trading-bot-web.zeabur.app";

// 驗證 LINE 簽名
function verifySignature(body: string, signature: string): boolean {
  if (!LINE_SECRET) return false; // Reject if secret not configured
  const hash = crypto.createHmac("sha256", LINE_SECRET).update(body).digest("base64");
  return hash === signature;
}

// 推播回覆訊息
async function replyMessage(replyToken: string, messages: object[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// 推播給指定用戶
async function pushMessage(userId: string, messages: object[]) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
}

// 取得最新 AI 訊號（按市場）
async function getLatestSignals(market?: string): Promise<string> {
  const db = supabaseAdmin();
  let query = db.from("signals").select("*").order("created_at", { ascending: false }).limit(5);
  if (market) query = query.eq("market", market);
  const { data } = await query;
  if (!data || data.length === 0) return "目前沒有最新訊號，AI 正在監控市場中...";

  const lines = data.map((s: Record<string, unknown>) => {
    const sig = s.signal_type === "BUY" ? "📈 買進" : s.signal_type === "SELL" ? "📉 賣出" : "⚖️ 觀望";
    const conf = ((s.confidence as number || 0) * 100).toFixed(0);
    const price = (s.price as number || 0).toLocaleString();
    const sl = (s.stop_loss as number || 0).toLocaleString();
    const tp = (s.target_price as number || 0).toLocaleString();
    const sym = s.symbol as string;
    const mkt = s.market as string;
    return `${sig} ${sym}（${mkt}）\n💰 現價: ${price}\n🛑 止損: ${sl} | 🎯 止盈: ${tp}\n信心: ${conf}%`;
  });

  return `🤖 最新 AI 訊號\n${"━".repeat(20)}\n${lines.join("\n\n")}`;
}

// 台股分析回覆
async function getTWAnalysis(): Promise<object[]> {
  const text = await getLatestSignals("TW");
  return [
    {
      type: "text",
      text: `🇹🇼 台股 AI 分析\n${"━".repeat(20)}\n${text}\n\n👇 查看完整訊號`,
    },
    {
      type: "template",
      altText: "查看台股訊號",
      template: {
        type: "buttons",
        text: "台股詳細分析",
        actions: [
          { type: "uri", label: "📊 查看訊號", uri: `${APP_URL}/dashboard` },
        ],
      },
    },
  ];
}

// 美股分析回覆
async function getUSAnalysis(): Promise<object[]> {
  const text = await getLatestSignals("US");
  return [
    {
      type: "text",
      text: `🇺🇸 美股 AI 分析\n${"━".repeat(20)}\n${text}\n\n👇 查看完整訊號`,
    },
    {
      type: "template",
      altText: "查看美股訊號",
      template: {
        type: "buttons",
        text: "美股詳細分析",
        actions: [
          { type: "uri", label: "📊 查看訊號", uri: `${APP_URL}/dashboard` },
        ],
      },
    },
  ];
}

// 持倉報告
async function getPortfolioReport(): Promise<string> {
  const db = supabaseAdmin();
  const { data: trades } = await db
    .from("trades")
    .select("*")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!trades || trades.length === 0) {
    return "💼 目前無開放持倉\n\nAI 持續監控市場，發現機會將立即通知您！";
  }

  const lines = trades.map((t: Record<string, unknown>) => {
    const pnl = ((t.pnl as number) || 0);
    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`;
    const pnlEmoji = pnl >= 0 ? "🟢" : "🔴";
    return `${pnlEmoji} ${t.symbol}（${t.side}）進場@${t.entry_price}\n損益: ${pnlStr}`;
  });

  return `💼 持倉報告\n${"━".repeat(20)}\n${lines.join("\n\n")}`;
}

// Flex Message: 訊號卡片
function buildSignalFlexMessage(signal: Record<string, unknown>): object {
  const sigColor = signal.signal_type === "BUY" ? "#22c55e" : signal.signal_type === "SELL" ? "#f43f5e" : "#94a3b8";
  const sigLabel = signal.signal_type === "BUY" ? "📈 買進" : signal.signal_type === "SELL" ? "📉 賣出" : "⚖️ 觀望";
  const conf = ((signal.confidence as number || 0) * 100).toFixed(0);
  const sym = signal.symbol as string;
  const mkt = signal.market as string;
  const price = (signal.price as number || 0);
  const sl = (signal.stop_loss as number || 0);
  const tp = (signal.target_price as number || 0);
  const slPct = price > 0 ? ((sl - price) / price * 100).toFixed(1) : "0";
  const tpPct = price > 0 ? ((tp - price) / price * 100).toFixed(1) : "0";
  const reasoning = ((signal.reasoning as string) || "").substring(0, 100);

  return {
    type: "flex",
    altText: `AI 訊號: ${sym} ${signal.signal_type}`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: "#0c1c10" } },
      header: {
        type: "box", layout: "horizontal",
        backgroundColor: "#081508",
        contents: [
          {
            type: "box", layout: "vertical",
            contents: [
              { type: "text", text: `${sym}`, color: "#ecfdf5", weight: "bold", size: "xl" },
              { type: "text", text: mkt === "TW" ? "🇹🇼 台股" : mkt === "US" ? "🇺🇸 美股" : `📊 ${mkt}`, color: "#86efac", size: "sm" },
            ]
          },
          {
            type: "box", layout: "vertical", alignItems: "flex-end",
            contents: [
              { type: "text", text: sigLabel, color: sigColor, weight: "bold", size: "lg" },
              { type: "text", text: `信心 ${conf}%`, color: "#86efac", size: "xs" },
            ]
          }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        backgroundColor: "#0c1c10",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              { type: "box", layout: "vertical", flex: 1, backgroundColor: "#112116", cornerRadius: "8px", paddingAll: "8px",
                contents: [
                  { type: "text", text: "進場價", color: "#4b7a5a", size: "xs" },
                  { type: "text", text: price > 0 ? price.toLocaleString() : "-", color: "#ecfdf5", weight: "bold", size: "sm" },
                ]
              },
              { type: "box", layout: "vertical", flex: 1, backgroundColor: "rgba(244,63,94,0.1)", cornerRadius: "8px", paddingAll: "8px",
                contents: [
                  { type: "text", text: "🛑 止損", color: "#f43f5e", size: "xs" },
                  { type: "text", text: sl > 0 ? `${sl.toLocaleString()}` : "-", color: "#f43f5e", weight: "bold", size: "sm" },
                  { type: "text", text: `(${slPct}%)`, color: "#f43f5e", size: "xxs" },
                ]
              },
              { type: "box", layout: "vertical", flex: 1, backgroundColor: "rgba(34,197,94,0.1)", cornerRadius: "8px", paddingAll: "8px",
                contents: [
                  { type: "text", text: "🎯 止盈", color: "#22c55e", size: "xs" },
                  { type: "text", text: tp > 0 ? `${tp.toLocaleString()}` : "-", color: "#22c55e", weight: "bold", size: "sm" },
                  { type: "text", text: `(+${tpPct}%)`, color: "#22c55e", size: "xxs" },
                ]
              },
            ]
          },
          { type: "separator", color: "#1a3525" },
          { type: "text", text: reasoning || "AI 分析中...", color: "#86efac", size: "xs", wrap: true, maxLines: 3 },
        ]
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm",
        backgroundColor: "#081508",
        contents: [
          {
            type: "button",
            action: { type: "uri", label: "📈 查看線圖", uri: `${APP_URL}/stock/${encodeURIComponent(sym)}` },
            style: "secondary",
            color: "#1a3525",
            height: "sm",
          }
        ]
      }
    }
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") || "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    const { type, replyToken, source, message } = event;
    const userId = source?.userId;

    if (type === "follow") {
      // 用戶加入好友
      await replyMessage(replyToken, [{
        type: "text",
        text: "🐸 歡迎加入呱呱投資俱樂部！\n\n我是您的 AI 操盤分析師，可以幫您：\n📊 即時買賣訊號\n📰 財經新聞分析\n🎯 止損止盈提醒\n\n點選下方選單開始使用！",
      }]);
      continue;
    }

    if (type !== "message" || !message || message.type !== "text") continue;

    const text = (message.text || "").trim();
    const lowerText = text.toLowerCase();

    try {
      // 處理各種指令
      if (lowerText.includes("台股") || lowerText.includes("tw")) {
        const msgs = await getTWAnalysis();
        await replyMessage(replyToken, msgs);

      } else if (lowerText.includes("美股") || lowerText.includes("us")) {
        const msgs = await getUSAnalysis();
        await replyMessage(replyToken, msgs);

      } else if (lowerText.includes("持倉") || lowerText.includes("倉位") || lowerText.includes("portfolio")) {
        const report = await getPortfolioReport();
        await replyMessage(replyToken, [{ type: "text", text: report }]);

      } else if (lowerText.includes("訊號") || lowerText.includes("signal")) {
        const db = supabaseAdmin();
        const { data: sigs } = await db
          .from("signals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3);

        if (!sigs || sigs.length === 0) {
          await replyMessage(replyToken, [{ type: "text", text: "目前無最新訊號，AI 正在分析市場中..." }]);
        } else {
          const flexMsgs = sigs.map(s => buildSignalFlexMessage(s as Record<string, unknown>));
          await replyMessage(replyToken, flexMsgs);
        }

      } else if (lowerText.includes("新聞") || lowerText.includes("news")) {
        await replyMessage(replyToken, [{
          type: "template",
          altText: "查看最新財經新聞",
          template: {
            type: "buttons",
            text: "📰 查看最新財經新聞",
            actions: [
              { type: "uri", label: "開啟新聞頁面", uri: `${APP_URL}/dashboard` },
            ],
          },
        }]);

      } else if (lowerText.includes("幫助") || lowerText.includes("help") || lowerText === "?") {
        await replyMessage(replyToken, [{
          type: "text",
          text: "🐸 AI 操盤師指令說明\n\n📊 訊號 - 最新買賣訊號\n🇹🇼 台股分析 - 台股AI報告\n🇺🇸 美股分析 - 美股AI報告\n💼 持倉報告 - 目前持倉狀態\n📰 新聞 - 財經新聞\n\n或直接點選下方圖文選單！",
        }]);

      } else {
        // 預設回覆
        await replyMessage(replyToken, [{
          type: "text",
          text: `收到你的訊息：「${text}」\n\n點選下方選單查看 AI 訊號，或輸入「訊號」、「台股」、「美股」等指令！`,
        }]);
      }
    } catch (err) {
      console.error("[LINE Webhook] 處理訊息失敗:", err);
    }
  }

  return NextResponse.json({ status: "ok" });
}

// 用於 LINE 驗證 webhook
export async function GET() {
  return NextResponse.json({ status: "LINE webhook is active" });
}
