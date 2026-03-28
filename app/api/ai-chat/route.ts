/**
 * AI 智能客服 — 股票深度分析 API
 * POST /api/ai-chat  { message: string, history?: Message[] }
 * 回傳：Streaming text (Vercel AI SDK 相容)
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

// Read ANTHROPIC_API_KEY from .env.local if system env is empty
// (Claude Code shell sets ANTHROPIC_API_KEY="" which overrides .env.local)
function getAnthropicKey(): string {
  const envKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (envKey) return envKey;
  try {
    const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
    const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match ? match[1].trim() : "";
  } catch { return ""; }
}

// ── Stock name lookup ─────────────────────────────────────────────────────────
const STOCK_NAMES: Record<string, string> = {
  // ── 台股：半導體/IC設計 ─────────────────────────────────────────
  "2330": "台積電", "2303": "聯電", "2454": "聯發科", "3711": "日月光投控",
  "5347": "世界先進", "6770": "力積電", "2344": "華邦電", "2337": "旺宏",
  "3034": "聯詠", "2379": "瑞昱", "6415": "矽力-KY", "3406": "玉晶光",
  "3443": "創意電子", "6789": "采鈺", "6488": "環球晶", "3037": "欣興",
  // ── 台股：電子/系統整合 ─────────────────────────────────────────
  "2317": "鴻海", "2357": "華碩", "2382": "廣達", "4938": "和碩",
  "3231": "緯創", "2301": "光寶科", "2474": "可成", "2376": "技嘉",
  "3008": "大立光", "2356": "英業達", "2353": "宏碁",
  "2409": "友達", "3481": "群創",
  // ── 台股：電子零組件/被動元件 ──────────────────────────────────
  "2308": "台達電", "2049": "上銀", "6669": "緯穎", "3017": "奇鋐",
  "2395": "研華", "2409": "友達",
  // ── 台股：電信 ─────────────────────────────────────────────────
  "2412": "中華電", "3045": "台灣大哥大",
  // ── 台股：金融 ─────────────────────────────────────────────────
  "2882": "國泰金", "2881": "富邦金", "2891": "中信金", "2886": "兆豐金",
  "2884": "玉山金", "2880": "華南金", "2883": "開發金", "2892": "第一金",
  "2887": "台新金", "2888": "新光金", "2885": "元大金", "5880": "合庫金",
  // ── 台股：傳產/原物料 ───────────────────────────────────────────
  "1301": "台塑", "1303": "南亞", "1326": "台化", "6505": "台塑化",
  "2002": "中鋼", "1229": "聯華", "1216": "統一", "1102": "亞泥", "1101": "台泥",
  // ── 台股：航運/運輸 ─────────────────────────────────────────────
  "2603": "長榮", "2615": "萬海", "2609": "陽明", "2610": "華航", "2618": "長榮航",
  // ── 台股：消費/流通 ─────────────────────────────────────────────
  "2912": "統一超", "2207": "和泰車",
  // ── 台股：ETF ───────────────────────────────────────────────────
  "0050": "元大台灣50", "0056": "元大高股息",
  "00878": "國泰永續高股息", "00881": "國泰台灣5G+",
  // ── 美股 ────────────────────────────────────────────────────────
  "NVDA": "NVIDIA", "TSLA": "Tesla", "AAPL": "Apple",
  "MSFT": "Microsoft", "AMZN": "Amazon", "GOOGL": "Alphabet",
  "META": "Meta", "AMD": "AMD", "INTC": "Intel",
  "TSM": "Taiwan Semi", "QCOM": "Qualcomm", "AVGO": "Broadcom",
  "NFLX": "Netflix", "UBER": "Uber", "ARM": "ARM Holdings",
  "SMCI": "Super Micro Computer",
  // ── 期貨 ────────────────────────────────────────────────────────
  "ES=F": "S&P500期貨", "NQ=F": "那斯達克期貨",
  "GC=F": "黃金期貨", "CL=F": "原油期貨",
  // ── 加密貨幣 ─────────────────────────────────────────────────────
  "BTC-USD": "比特幣", "ETH-USD": "以太幣", "SOL-USD": "Solana",
};

// Name → symbol reverse lookup
const NAME_TO_SYM: Record<string, string> = {};
for (const [sym, name] of Object.entries(STOCK_NAMES)) {
  NAME_TO_SYM[name] = sym;
  NAME_TO_SYM[name.toLowerCase()] = sym;
}

// ── Detect stock symbol from free-form message ────────────────────────────────
function detectStock(msg: string): { symbol: string; market: string; name: string } | null {
  const clean = msg.trim();

  // 1. TW code: 4–6 digit number (handle ALL codes, not just ones in our dict)
  const twMatch = clean.match(/\b(\d{4,6})\b/);
  if (twMatch) {
    const sym = twMatch[1];
    // Use known name if available, otherwise use code itself — never guess
    const name = STOCK_NAMES[sym] || `股票代碼 ${sym}`;
    return { symbol: sym, market: "TW", name };
  }

  // 2. Chinese name lookup (exact match only)
  for (const [name, sym] of Object.entries(NAME_TO_SYM)) {
    if (name.length >= 2 && clean.includes(name)) {
      const mkt = /^\d/.test(sym) ? "TW"
        : ["BTC-USD","ETH-USD","SOL-USD"].includes(sym) ? "CRYPTO"
        : sym.endsWith("=F") ? "FUTURES" : "US";
      return { symbol: sym, market: mkt, name: STOCK_NAMES[sym] || sym };
    }
  }

  // 3. US ticker: 2–5 uppercase letters (must be in our known list)
  const usMatch = clean.match(/\b([A-Z]{2,5})\b/);
  if (usMatch) {
    const sym = usMatch[1];
    if (STOCK_NAMES[sym]) {
      const mkt = ["BTC-USD","ETH-USD","SOL-USD"].includes(sym) ? "CRYPTO"
        : sym.endsWith("=F") ? "FUTURES" : "US";
      return { symbol: sym, market: mkt, name: STOCK_NAMES[sym] };
    }
  }

  return null;
}

// ── Fetch OHLCV summary from Yahoo Finance ────────────────────────────────────
async function fetchOHLCV(symbol: string, market: string, period: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/ohlcv?symbol=${encodeURIComponent(symbol)}&market=${market}&period=${period}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    const candles = data.candles || [];
    if (candles.length === 0) return null;

    const first = candles[0];
    const last  = candles[candles.length - 1];
    const highs  = candles.map((c: { high: number }) => c.high);
    const lows   = candles.map((c: { low: number }) => c.low);
    const vols   = candles.map((c: { volume: number }) => c.volume);
    const avgVol = vols.reduce((s: number, v: number) => s + v, 0) / vols.length;
    const change = ((last.close - first.open) / first.open * 100).toFixed(2);

    // Simple RSI (14-day)
    let gains = 0, losses = 0;
    const closes = candles.map((c: { close: number }) => c.close);
    for (let i = 1; i <= Math.min(14, closes.length - 1); i++) {
      const diff = closes[closes.length - i] - closes[closes.length - i - 1];
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const rs = gains / (losses || 1);
    const rsi = +(100 - 100 / (1 + rs)).toFixed(1);

    // MA20 last value
    const ma20 = data.ma20?.length > 0 ? data.ma20[data.ma20.length - 1].value : null;

    return {
      period,
      open: first.open,
      close: last.close,
      high: Math.max(...highs),
      low: Math.min(...lows),
      change_pct: change,
      avg_volume: Math.round(avgVol),
      rsi,
      ma20: ma20 ? +ma20.toFixed(2) : null,
      candle_count: candles.length,
    };
  } catch { return null; }
}

// ── Fetch recent signals from Supabase ────────────────────────────────────────
async function fetchSignals(symbol: string) {
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("signals").select("*")
      .eq("symbol", symbol)
      .order("created_at", { ascending: false })
      .limit(5);
    return data || [];
  } catch { return []; }
}

// ── Fetch chip data ───────────────────────────────────────────────────────────
async function fetchChip(symbol: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/chip?symbol=${symbol}`, { cache: "no-store" });
    return await res.json();
  } catch { return null; }
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message: string = body.message || "";
  const history: { role: string; content: string }[] = body.history || [];

  if (!message.trim()) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
  }

  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }
  const client = new Anthropic({ apiKey });

  // Detect if user is asking about a specific stock
  const stockInfo = detectStock(message);
  let contextBlock = "";

  if (stockInfo) {
    // Fetch data in parallel
    const [data3m, data6m, data1y, signals, chip] = await Promise.all([
      fetchOHLCV(stockInfo.symbol, stockInfo.market, "3mo"),
      fetchOHLCV(stockInfo.symbol, stockInfo.market, "6mo"),
      fetchOHLCV(stockInfo.symbol, stockInfo.market, "1y"),
      fetchSignals(stockInfo.symbol),
      stockInfo.market === "TW" ? fetchChip(stockInfo.symbol) : Promise.resolve(null),
    ]);

    const fmt = (v: unknown) => v ?? "無資料";

    // If all data is null, explicitly flag it so Claude doesn't hallucinate
    const hasData = data3m || data6m || data1y;
    contextBlock = `
=== 股票資料 ===
標的：${stockInfo.name} (${stockInfo.symbol})  市場：${stockInfo.market}
${!hasData ? "⚠️ 警告：此代碼無法從市場取得任何價格數據，請告知用戶無法分析，不要自行編造任何數據。" : ""}
現價：${data3m?.close ?? "無資料"}

--- 技術面 ---
3個月：開 ${fmt(data3m?.open)}  收 ${fmt(data3m?.close)}  高 ${fmt(data3m?.high)}  低 ${fmt(data3m?.low)}  漲跌 ${fmt(data3m?.change_pct)}%  RSI ${fmt(data3m?.rsi)}  MA20 ${fmt(data3m?.ma20)}
6個月：開 ${fmt(data6m?.open)}  收 ${fmt(data6m?.close)}  高 ${fmt(data6m?.high)}  低 ${fmt(data6m?.low)}  漲跌 ${fmt(data6m?.change_pct)}%  RSI ${fmt(data6m?.rsi)}  MA20 ${fmt(data6m?.ma20)}
1年：  開 ${fmt(data1y?.open)}  收 ${fmt(data1y?.close)}  高 ${fmt(data1y?.high)}  低 ${fmt(data1y?.low)}  漲跌 ${fmt(data1y?.change_pct)}%  RSI ${fmt(data1y?.rsi)}  MA20 ${fmt(data1y?.ma20)}

--- 籌碼面 (台股) ---
${chip ? JSON.stringify(chip, null, 2) : "無籌碼資料"}

--- AI歷史訊號 (最近5筆) ---
${signals.length > 0
  ? signals.map((s: Record<string, unknown>) =>
    `[${s.signal_type}] 價格:${s.price} 信心:${s.confidence}% 時間:${s.created_at} 理由:${String(s.reasoning || "").slice(0, 80)}`
  ).join("\n")
  : "無歷史訊號"}
`;
  }

  // Build system prompt
  const systemPrompt = `你是「呱呱投資俱樂部」的 AI 首席分析師 🤖，代號「蛙哥分析師」。

【最重要規則】
- 分析股票時，只能根據系統提供的「=== 股票資料 ===」數據進行分析
- 絕對不能用你的訓練知識去猜測或補充任何股票的名稱、價格、漲跌、公司資訊
- 若系統沒有提供資料（顯示「無資料」），必須明確說明「目前無法取得 XX 的即時數據，無法進行分析」
- 股票代碼對應的公司名稱以系統提供的為準，不自行判斷

你的特點：
- 勝率極高，分析客觀精確，不說廢話
- 用繁體中文回答，語氣專業但親切
- 誠實給出結論：若不適合進場就直說不建議進場，不強迫給買賣建議
- 重要數字一定要標示（技術指標、目標價、止損點）

分析框架（若有股票資料）：
1. 🔍 技術面分析（MA20趨勢、RSI強弱、支撐/壓力位）
2. 📊 3個月 / 6個月 / 1年表現回顧
3. 🏦 籌碼面分析（法人動向，若有資料）
4. 🎯 AI操作建議（誠實判斷：買進 / 賣出 / 不建議進場）
   - 若建議進場：給出建議區間價、目標價、止損點、持有天數、信心分數
   - 若不建議進場：說明原因，指出什麼條件成立才值得重新評估
5. ⚠️ 主要風險提示

若用戶不是問股票，提供有用的金融投資建議。
回應格式：結構清晰，重要數字加粗（**價格**），善用表情符號。限制800字。`;

  // Build messages
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map(h => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: h.content,
    })),
    {
      role: "user",
      content: contextBlock
        ? `${contextBlock}\n\n用戶問題：${message}`
        : message,
    },
  ];

  // Streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          stream: true,
        });

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[分析錯誤: ${String(err)}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
