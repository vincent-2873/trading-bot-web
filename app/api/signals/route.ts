import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market");
  const limit  = parseInt(searchParams.get("limit") || "20");

  const symbol = searchParams.get("symbol");

  try {
    const db = supabaseAdmin();
    // Exclude ETFs and hidden signals
    const ETF_SYMBOLS = ["0050","0056","00878","00929","00919","006208","00646","00692"];
    let query = db.from("signals").select("*")
      .not("signal_type", "eq", "ETF_SKIP")
      .not("symbol", "in", `(${ETF_SYMBOLS.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (market && market !== "ALL") query = query.eq("market", market);
    if (symbol) query = query.eq("symbol", symbol);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ signals: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
