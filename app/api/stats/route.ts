import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const [signalsRes, posRes, reviewRes, usersRes] = await Promise.all([
      db.from("signals").select("signal_type, market, created_at").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      db.from("positions").select("status, pnl_pct").eq("status", "CLOSED"),
      db.from("review_reports").select("*").order("created_at", { ascending: false }).limit(1),
      db.from("line_users").select("id", { count: "exact" }).eq("subscribed", true),
    ]);

    const signals  = signalsRes.data  || [];
    const positions = posRes.data     || [];
    const latestReview = reviewRes.data?.[0];

    const byMarket: Record<string, number> = {};
    signals.forEach(s => { byMarket[s.market] = (byMarket[s.market] || 0) + 1; });

    const wins    = positions.filter(p => (p.pnl_pct || 0) > 0).length;
    const winRate = positions.length > 0 ? Math.round(wins / positions.length * 100) : 0;
    const totalPnl = positions.reduce((a, p) => a + (p.pnl_pct || 0), 0);

    return NextResponse.json({
      signals_7d:    signals.length,
      buy_signals:   signals.filter(s => s.signal_type === "BUY").length,
      sell_signals:  signals.filter(s => s.signal_type === "SELL").length,
      by_market:     byMarket,
      win_rate:      winRate,
      total_trades:  positions.length,
      total_pnl:     Math.round(totalPnl * 100) / 100,
      subscribers:   usersRes.count || 0,
      latest_review: latestReview?.ai_review || null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
