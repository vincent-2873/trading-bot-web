"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const LINE_URL = () =>
  `https://access.line.me/oauth2/v2.1/authorize?response_type=code` +
  `&client_id=${process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2009625319"}` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/auth/line/callback"
  )}&state=login&scope=profile%20openid%20email`;

const FEATURES = [
  { icon: "🇹🇼", color: "#38bdf8", title: "台股", desc: "半導體、金融、生技等各產業即時分析" },
  { icon: "🇺🇸", color: "#fbbf24", title: "美股", desc: "NVDA、TSLA 等科技龍頭 AI 訊號" },
  { icon: "📊", color: "#fb923c", title: "期貨", desc: "台指期、S&P 500 期貨趨勢判斷" },
  { icon: "🪙", color: "#c084fc", title: "加密貨幣", desc: "BTC、ETH、SOL 含恐懼貪婪指數" },
  { icon: "🧠", color: "#22c55e", title: "Claude AI 分析", desc: "深度新聞情緒 + 技術面融合判斷" },
  { icon: "🔔", color: "#22c55e", title: "LINE 即時推播", desc: "訊號產生立即推播，不錯過每個機會" },
  { icon: "🛑", color: "#f43f5e", title: "動態止損止盈", desc: "ATR 動態計算，精準風險控制" },
  { icon: "📈", color: "#fbbf24", title: "績效追蹤", desc: "勝率、夏普比率、最大回撤完整統計" },
];

const STEPS = [
  { num: "01", title: "LINE 登入", desc: "一鍵綁定你的 LINE 帳號" },
  { num: "02", title: "選擇市場", desc: "自由勾選台股、美股、期貨、加密" },
  { num: "03", title: "接收訊號", desc: "AI 分析完成即時推播到你的 LINE" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lineUrl, setLineUrl] = useState("#");

  useEffect(() => {
    setLineUrl(LINE_URL());
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,16,10,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.25rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>🐸</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--t1)", lineHeight: 1.2 }}>呱呱投資俱樂部</div>
            <div style={{ fontSize: "0.68rem", color: "var(--green)", opacity: 0.9 }}>AI 智能交易訊號</div>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="sm-hide" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/dashboard" style={{ color: "var(--t2)", fontSize: "0.9rem", textDecoration: "none", padding: "0.4rem 0.75rem" }}>
            儀表板
          </Link>
          <a href={lineUrl} className="btn btn-line" style={{ fontSize: "0.85rem", minHeight: 38, padding: "0 1.2rem" }}>
            <span>▶</span> LINE 登入
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="show-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", color: "var(--t1)", fontSize: "1.4rem", cursor: "pointer", padding: "0.5rem", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{ color: "var(--t2)", textDecoration: "none", padding: "0.75rem", borderRadius: "10px", background: "var(--bg-card)", display: "block" }}>
            📊 儀表板
          </Link>
          <a href={lineUrl} className="btn btn-line" style={{ width: "100%", justifyContent: "center" }}>
            <span>▶</span> LINE 登入開始使用
          </a>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ textAlign: "center", padding: "clamp(3rem,8vw,5rem) 1.25rem 3rem" }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          background: "rgba(34,197,94,0.1)", color: "var(--green-light)",
          padding: "0.4rem 1.1rem", borderRadius: "20px", fontSize: "0.83rem",
          border: "1px solid rgba(34,197,94,0.25)", marginBottom: "1.75rem",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulseDot 2s infinite" }}></span>
          🤖 AI 即時分析 · 24/7 市場監控
        </div>

        <h1 style={{
          fontSize: "clamp(2.1rem,5.5vw,3.8rem)", fontWeight: 900,
          lineHeight: 1.15, marginBottom: "1.25rem", color: "var(--t1)",
          letterSpacing: "-0.5px",
        }}>
          讓 AI 幫你找到<br />
          <span style={{
            background: "linear-gradient(90deg, #4ade80, #22c55e, #fbbf24)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            最佳買賣時機
          </span>
        </h1>

        <p style={{
          color: "var(--t2)", fontSize: "clamp(0.95rem,2.5vw,1.15rem)",
          maxWidth: 580, margin: "0 auto 2.25rem", lineHeight: 1.75, opacity: 0.85,
        }}>
          整合台股、美股、期貨、加密貨幣，透過 Claude AI 深度分析技術面、消息面，
          自動推播買進/賣出訊號到你的 LINE。
        </p>

        <div style={{ display: "flex", gap: "0.9rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href={lineUrl} className="btn btn-line" style={{ fontSize: "1rem", padding: "0.8rem 2rem", minHeight: 52 }}>
            🔗 LINE 登入開始使用
          </a>
          <Link href="/dashboard" className="btn btn-ghost" style={{ fontSize: "1rem", padding: "0.8rem 2rem", minHeight: 52 }}>
            📊 查看儀表板
          </Link>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "clamp(1.5rem,4vw,3rem)",
          flexWrap: "wrap", marginTop: "3rem",
        }}>
          {[
            { label: "支援市場", value: "4+" },
            { label: "分析指標", value: "20+" },
            { label: "AI 模型", value: "Claude" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 800, color: "var(--green-light)" }}>{s.value}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--t3)", marginTop: "0.2rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "2rem 1.25rem 3rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 800, marginBottom: "2rem", color: "var(--t1)" }}>
            三步驟開始使用
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem" }}>
            {STEPS.map((s, i) => (
              <div key={s.num} className="card" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{
                  fontSize: "3.5rem", fontWeight: 900, color: "var(--border2)",
                  position: "absolute", top: -10, right: 10, lineHeight: 1, userSelect: "none",
                }}>{s.num}</div>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                  {["📲", "🎯", "🔔"][i]}
                </div>
                <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.4rem" }}>{s.title}</div>
                <div style={{ color: "var(--t3)", fontSize: "0.88rem" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "1rem 1.25rem 4rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 800, marginBottom: "0.6rem", color: "var(--t1)" }}>
            全方位智能投資功能
          </h2>
          <p style={{ textAlign: "center", color: "var(--t3)", marginBottom: "2rem", fontSize: "0.9rem" }}>
            一個平台，掌握四大市場的 AI 投資訊號
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))", gap: "0.85rem" }}>
            {FEATURES.map(f => (
              <div key={f.title} className="card" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "0.75rem", padding: "0.9rem 1rem" }}>
                <div style={{ fontSize: "1.6rem", flexShrink: 0, lineHeight: 1 }}>{f.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: "0.92rem", marginBottom: "0.2rem" }}>{f.title}</div>
                  <div style={{ color: "var(--t3)", fontSize: "0.82rem", lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        margin: "0 1.25rem 4rem", padding: "2.5rem 1.5rem",
        background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(251,191,36,0.06))",
        border: "1px solid var(--border)",
        borderRadius: 20, textAlign: "center",
        maxWidth: 700, marginLeft: "auto", marginRight: "auto",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🐸</div>
        <h2 style={{ fontSize: "clamp(1.3rem,3vw,1.7rem)", fontWeight: 800, color: "var(--t1)", marginBottom: "0.75rem" }}>
          立即加入呱呱投資俱樂部
        </h2>
        <p style={{ color: "var(--t3)", marginBottom: "1.5rem", fontSize: "0.9rem", lineHeight: 1.7 }}>
          免費使用，透過 LINE 接收 AI 智能買賣訊號
        </p>
        <a href={lineUrl} className="btn btn-line" style={{ fontSize: "1rem", padding: "0.85rem 2.5rem", minHeight: 52 }}>
          🔗 LINE 登入，免費開始
        </a>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: "center", padding: "2rem 1.25rem",
        borderTop: "1px solid var(--border)",
        color: "var(--t3)", fontSize: "0.82rem",
      }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🐸</div>
        <div>呱呱投資俱樂部 © 2026 · 本平台訊號僅供參考，投資有風險，請審慎評估</div>
      </footer>
    </div>
  );
}
