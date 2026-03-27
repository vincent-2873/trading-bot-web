import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market");
  const limit  = parseInt(searchParams.get("limit") || "20");

  try {
    const db = supabaseAdmin();
    let query = db.from("signals").select("*").order("created_at", { ascending: false }).limit(limit);
    if (market && market !== "ALL") query = query.eq("market", market);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ signals: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
