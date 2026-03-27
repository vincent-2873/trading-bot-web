import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const lineUserId = req.cookies.get("line_user_id")?.value;
  if (!lineUserId) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { subscribed, markets } = await req.json();
  try {
    const db = supabaseAdmin();
    const update: Record<string, unknown> = {};
    if (typeof subscribed === "boolean") update.subscribed = subscribed;
    if (Array.isArray(markets))          update.markets    = markets;

    await db.from("line_users").update(update).eq("line_user_id", lineUserId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const lineUserId = req.cookies.get("line_user_id")?.value;
  if (!lineUserId) return NextResponse.json({ subscribed: false, markets: [] });

  try {
    const db = supabaseAdmin();
    const { data } = await db.from("line_users")
      .select("subscribed,markets").eq("line_user_id", lineUserId).single();
    return NextResponse.json(data || { subscribed: false, markets: [] });
  } catch {
    return NextResponse.json({ subscribed: false, markets: [] });
  }
}
