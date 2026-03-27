"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const LINE_LOGIN_URL = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2009625319"}&redirect_uri=${encodeURIComponent((process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/auth/line/callback")}&state=login&scope=profile%20openid%20email`;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0e1a 0%, #0d1a2e 50%, #0a0e1a 100%)" }}>
      {/* Header */}
      <nav style={{ borderBottom: "1px solid #1e2d45", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "2rem" }}>🐸</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#e2e8f0" }}>呱呱投資俱樂部</div>
            <div style={{ fontSize: "0.75rem", color: "#4f8ef7" }}>AI 智能交易訊號</div>
          </div>
        </div>
        <a href={LINE_LOGIN_URL}
          style={{ background: "#06c755", color: "white", padding: "0.6rem 1.5rem", borderRadius: "8px", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>▶</span> LINE 登入
        </a>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "5rem 2rem 3rem" }}>
        <div style={{ display: "inline-block", background: "rgba(0,255,136,0.1)", color: "#00ff88", padding: "0.4rem 1rem", borderRadius: "20px", fontSize: "0.85rem", marginBottom: "1.5rem", border: "1px solid rgba(0,255,136,0.3)" }}>
          🤖 AI 即時分析 · 24/7 市場監控
        </div>
        <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: "#e2e8f0", lineHeight: 1.2, marginBottom: "1.5rem" }}>
          讓 AI 幫你找到<br />
          <span style={{ background: "linear-gradient(90deg,#00ff88,#4f8ef7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>最佳買賣時機</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto 2.5rem", lineHeight: 1.7 }}>
          整合台股、美股、期貨、加密貨幣，透過 Claude AI 深度分析技術面、消息面，
          自動推播買進/賣出訊號到你的 LINE。
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href={LINE_LOGIN_URL}
            style={{ background: "linear-gradient(135deg,#06c755,#00a844)", color: "white", padding: "1rem 2.5rem", borderRadius: "12px", fontWeight: 700, textDecoration: "none", fontSize: "1.1rem" }}>
            🔗 LINE 登入開始使用
          </a>
          <Link href="/dashboard"
            style={{ background: "rgba(79,142,247,0.15)", color: "#4f8ef7", padding: "1rem 2.5rem", borderRadius: "12px", fontWeight: 600, textDecoration: "none", fontSize: "1.1rem", border: "1px solid rgba(79,142,247,0.3)" }}>
            📊 查看儀表板
          </Link>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1.5rem" }}>
        {[
          { icon: "🇹🇼", title: "台股", desc: "台積電、聯發科等熱門標的即時分析" },
          { icon: "🇺🇸", title: "美股", desc: "NVDA、TSLA 等科技龍頭 AI 訊號" },
          { icon: "📊", title: "期貨", desc: "台指期、S&P 500 期貨趨勢判斷" },
          { icon: "🪙", title: "加密貨幣", desc: "BTC、ETH、SOL 含恐懼貪婪指數" },
          { icon: "🧠", title: "AI 深度分析", desc: "Claude 每次復盤自動優化策略參數" },
          { icon: "🔔", title: "LINE 推播", desc: "訊號產生即時推播到你的 LINE" },
          { icon: "🛑", title: "止損止盈", desc: "ATR 動態計算，精準風險控制" },
          { icon: "📈", title: "績效追蹤", desc: "勝率、夏普比率、最大回撤完整統計" },
        ].map(f => (
          <div key={f.title} style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{f.icon}</div>
            <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: "0.5rem" }}>{f.title}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#475569", borderTop: "1px solid #1e2d45", marginTop: "3rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🐸</div>
        <div>呱呱投資俱樂部 © 2026 · 本平台訊號僅供參考，投資有風險</div>
      </div>
    </div>
  );
}
