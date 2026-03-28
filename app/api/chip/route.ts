/**
 * 台股籌碼面 API
 * GET /api/chip?symbol=2330
 * 資料來源：TWSE 免費公開 API
 */
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600; // 1-hour cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";

  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 });

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  try {
    // 三大法人買賣超
    const t86Res = await fetch(
      `https://www.twse.com.tw/fund/T86?response=json&date=${dateStr}&selectType=ALL`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );

    let foreign_net = 0, trust_net = 0, dealer_net = 0, total_net = 0;

    if (t86Res.ok) {
      const t86 = await t86Res.json();
      if (t86.stat === "OK" && Array.isArray(t86.data)) {
        const row = t86.data.find((r: string[]) => r[0]?.trim() === symbol);
        if (row && row.length >= 10) {
          const parse = (s: string) => parseInt(String(s).replace(/,/g, "").replace(/\+/g, "") || "0");
          foreign_net = parse(row[4]);
          trust_net   = parse(row[7]);
          dealer_net  = parse(row[8]);
          total_net   = parse(row[9]);
        }
      }
    }

    // 融資融券
    let margin_buy = 0, margin_sell = 0, short_sell = 0;
    try {
      const marginRes = await fetch(
        `https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=${dateStr}&selectType=ALL`,
        { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
      );
      if (marginRes.ok) {
        const marginData = await marginRes.json();
        if (marginData.stat === "OK" && Array.isArray(marginData.data)) {
          const row = marginData.data.find((r: string[]) => r[0]?.trim() === symbol);
          if (row && row.length > 10) {
            const parse = (s: string) => parseInt(String(s).replace(/,/g, "") || "0");
            margin_buy  = parse(row[2]);
            margin_sell = parse(row[3]);
            short_sell  = parse(row[10]);
          }
        }
      }
    } catch { /* ignore margin errors */ }

    const chip_score = Math.max(-1, Math.min(1, Math.tanh((foreign_net * 0.6 + trust_net * 0.3 + dealer_net * 0.1) / 1000)));

    return NextResponse.json({
      symbol, date: dateStr,
      foreign_net, trust_net, dealer_net, total_net,
      margin_buy, margin_sell, short_sell,
      chip_score: Math.round(chip_score * 1000) / 1000,
    });
  } catch (err) {
    console.error("Chip API error:", err);
    return NextResponse.json({ symbol, foreign_net: 0, trust_net: 0, dealer_net: 0, total_net: 0, chip_score: 0 });
  }
}
