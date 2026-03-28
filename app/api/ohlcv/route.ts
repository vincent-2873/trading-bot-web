/**
 * OHLCV K線資料 API
 * GET /api/ohlcv?symbol=AAPL&market=US&period=3mo
 * 資料來源：Yahoo Finance Chart API (免費，無需認證)
 */
import { NextRequest, NextResponse } from "next/server";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";
  const market = searchParams.get("market") || "US";
  const period = searchParams.get("period") || "3mo";
  const interval = searchParams.get("interval") || "1d";

  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  // Build Yahoo Finance ticker
  let ticker = symbol;
  if (market === "TW" && !symbol.startsWith("^")) ticker = `${symbol}.TW`;
  // For futures like ES=F, NQ=F — Yahoo Finance accepts them as-is
  // For crypto like BTC-USD — Yahoo Finance accepts as-is

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${period}&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ candles: [], error: `Yahoo Finance error: ${res.status}` });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ candles: [] });
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens: number[]   = quote.open   || [];
    const highs: number[]   = quote.high   || [];
    const lows: number[]    = quote.low    || [];
    const closes: number[]  = quote.close  || [];
    const volumes: number[] = quote.volume || [];

    const candles: Candle[] = [];
    const ma5:  { time: number; value: number }[] = [];
    const ma20: { time: number; value: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({ time: timestamps[i], open: +o.toFixed(3), high: +h.toFixed(3), low: +l.toFixed(3), close: +c.toFixed(3), volume: v || 0 });
    }

    // Calculate MA5 and MA20
    for (let i = 4; i < candles.length; i++) {
      const avg5 = candles.slice(i - 4, i + 1).reduce((s, c) => s + c.close, 0) / 5;
      ma5.push({ time: candles[i].time, value: +avg5.toFixed(3) });
    }
    for (let i = 19; i < candles.length; i++) {
      const avg20 = candles.slice(i - 19, i + 1).reduce((s, c) => s + c.close, 0) / 20;
      ma20.push({ time: candles[i].time, value: +avg20.toFixed(3) });
    }

    const meta = result.meta || {};
    return NextResponse.json({
      candles,
      ma5,
      ma20,
      meta: {
        symbol: meta.symbol || symbol,
        currency: meta.currency || "USD",
        regularMarketPrice: meta.regularMarketPrice,
        chartPreviousClose: meta.chartPreviousClose,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("OHLCV error:", err);
    return NextResponse.json({ candles: [], error: String(err) });
  }
}
