import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=line_auth_failed", req.url));
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 1. 換取 access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  `${appUrl}/api/auth/line/callback`,
        client_id:     process.env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("No access token");

    // 2. 取得用戶 Profile
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const { userId, displayName, pictureUrl } = profile;

    // 3. 儲存/更新到 Supabase
    const db = supabaseAdmin();
    await db.from("line_users").upsert({
      line_user_id: userId,
      display_name: displayName,
      picture_url:  pictureUrl || "",
      subscribed:   true,
      markets:      ["TW", "US", "FUTURES", "CRYPTO"],
      last_login:   new Date().toISOString(),
    }, { onConflict: "line_user_id" });

    // 4. 建立 session cookie 並跳轉 dashboard
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("line_user_id",   userId,      { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set("display_name",   displayName, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set("picture_url",    pictureUrl || "", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;

  } catch (e) {
    console.error("[LINE AUTH]", e);
    return NextResponse.redirect(new URL("/?error=auth_error", req.url));
  }
}
