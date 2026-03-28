/**
 * 訊號績效追蹤 API
 * GET /api/performance → aggregate metrics + recent records
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const revalidate = 0;

export async function GET() {
  try {
    // Get recent performance records
    const { data: records, error } = await supabase
      .from("signal_performance")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = records || [];
    const finalized = rows.filter(r => r.outcome !== "PENDING");
    const total = finalized.length;
    const wins  = finalized.filter(r => r.outcome === "WIN").length;
    const win_rate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;

    const returns14 = finalized
      .filter(r => r.return_14d != null)
      .map(r => parseFloat(r.return_14d));
    const avg_return = returns14.length > 0
      ? Math.round(returns14.reduce((a, b) => a + b, 0) / returns14.length * 100) / 100
      : 0;

    const returns7 = finalized
      .filter(r => r.return_7d != null)
      .map(r => parseFloat(r.return_7d));
    let sharpe = 0;
    if (returns7.length > 2) {
      const mean = returns7.reduce((a, b) => a + b, 0) / returns7.length;
      const std  = Math.sqrt(returns7.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / returns7.length);
      sharpe = std > 0 ? Math.round((mean / std) * Math.sqrt(18) * 100) / 100 : 0;
    }

    // By-market breakdown
    const byMarket: Record<string, { total: number; wins: number; win_rate: number }> = {};
    for (const r of finalized) {
      const m = r.market || "US";
      if (!byMarket[m]) byMarket[m] = { total: 0, wins: 0, win_rate: 0 };
      byMarket[m].total++;
      if (r.outcome === "WIN") byMarket[m].wins++;
    }
    for (const m of Object.keys(byMarket)) {
      const { total: t, wins: w } = byMarket[m];
      byMarket[m].win_rate = t > 0 ? Math.round((w / t) * 1000) / 10 : 0;
    }

    return NextResponse.json({
      metrics: { total, wins, win_rate, avg_return, sharpe, by_market: byMarket },
      records: rows.slice(0, 30),
    });
  } catch (err) {
    console.error("Performance API error:", err);
    return NextResponse.json({ metrics: { total: 0, win_rate: 0 }, records: [] });
  }
}
