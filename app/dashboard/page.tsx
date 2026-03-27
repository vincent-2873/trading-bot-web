"use client";
import { useEffect, useState, useCallback } from "react";

type Signal = {
  id: number; symbol: string; market: string; signal_type: string;
  signal_strength: number; entry_price: number; stop_loss: number;
  take_profit: number; ai_analysis: string; technical_summary: string;
  news_sentiment: string; created_at: string;
};
type Stats = {
  signals_7d: number; buy_signals: number; sell_signals: number;
  by_market: Record<string, number>; win_rate: number; total_trades: number;
  total_pnl: number; subscribers: number;
  latest_review: Record<string, unknown> | null;
};
type Sub = { subscribed: boolean; markets: string[] };

const MARKETS = ["ALL","TW","US","FUTURES","CRYPTO"];
const MARKET_LABEL: Record<string, string> = { TW:"🇹🇼 台股", US:"🇺🇸 美股", FUTURES:"📊 期貨", CRYPTO:"🪙 加密" };
const SIGNAL_COLOR: Record<string, string> = { BUY:"#00ff88", SELL:"#ff4444", HOLD:"#94a3b8" };
const SENTIMENT_LABEL: Record<string, string> = { POSITIVE:"📈 正面", NEGATIVE:"📉 負面", NEUTRAL:"➡️ 中性" };

function StatCard({ label, value, sub, color }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div style={{ background:"#111827", border:"1px solid #1e2d45", borderRadius:"12px", padding:"1.25rem" }}>
      <div style={{ color:"#94a3b8", fontSize:"0.8rem", marginBottom:"0.4rem" }}>{label}</div>
      <div style={{ fontSize:"1.8rem", fontWeight:800, color: color || "#e2e8f0" }}>{value}</div>
      {sub && <div style={{ color:"#475569", fontSize:"0.75rem", marginTop:"0.25rem" }}>{sub}</div>}
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const sColor = SIGNAL_COLOR[signal.signal_type] || "#94a3b8";
  const sl_pct = signal.entry_price > 0 ? ((signal.stop_loss - signal.entry_price) / signal.entry_price * 100).toFixed(1) : "0";
  const tp_pct = signal.entry_price > 0 ? ((signal.take_profit - signal.entry_price) / signal.entry_price * 100).toFixed(1) : "0";

  return (
    <div onClick={() => setExpanded(!expanded)} style={{ background:"#111827", border:`1px solid ${expanded ? sColor+"44" : "#1e2d45"}`, borderRadius:"12px", padding:"1.25rem", cursor:"pointer", transition:"all 0.2s" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"1.4rem", fontWeight:800, color:"#e2e8f0" }}>{signal.symbol}</span>
          <span style={{ background: sColor+"22", color: sColor, padding:"2px 10px", borderRadius:"6px", fontWeight:700, fontSize:"0.85rem" }}>{signal.signal_type}</span>
          <span style={{ background:"#1e2d45", color:"#94a3b8", padding:"2px 8px", borderRadius:"6px", fontSize:"0.8rem" }}>{MARKET_LABEL[signal.market] || signal.market}</span>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"#4f8ef7", fontWeight:700 }}>{(signal.signal_strength * 100).toFixed(0)}%</div>
          <div style={{ color:"#475569", fontSize:"0.75rem" }}>信心度</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.75rem", marginBottom:"0.75rem" }}>
        <div style={{ textAlign:"center", background:"#0d1520", borderRadius:"8px", padding:"0.5rem" }}>
          <div style={{ color:"#94a3b8", fontSize:"0.7rem" }}>進場</div>
          <div style={{ color:"#e2e8f0", fontWeight:700 }}>{signal.entry_price.toLocaleString()}</div>
        </div>
        <div style={{ textAlign:"center", background:"#0d1520", borderRadius:"8px", padding:"0.5rem" }}>
          <div style={{ color:"#94a3b8", fontSize:"0.7rem" }}>止損</div>
          <div style={{ color:"#ff4444", fontWeight:700 }}>{signal.stop_loss.toLocaleString()}<span style={{ color:"#94a3b8", fontSize:"0.75rem" }}> ({sl_pct}%)</span></div>
        </div>
        <div style={{ textAlign:"center", background:"#0d1520", borderRadius:"8px", padding:"0.5rem" }}>
          <div style={{ color:"#94a3b8", fontSize:"0.7rem" }}>止盈</div>
          <div style={{ color:"#00ff88", fontWeight:700 }}>{signal.take_profit.toLocaleString()}<span style={{ color:"#94a3b8", fontSize:"0.75rem" }}> (+{tp_pct}%)</span></div>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"0.8rem", color:"#475569" }}>{SENTIMENT_LABEL[signal.news_sentiment]}</span>
        <span style={{ fontSize:"0.75rem", color:"#475569" }}>{new Date(signal.created_at).toLocaleString("zh-TW")}</span>
      </div>

      {expanded && (
        <div style={{ marginTop:"1rem", borderTop:"1px solid #1e2d45", paddingTop:"1rem" }}>
          <div style={{ fontSize:"0.85rem", color:"#94a3b8", marginBottom:"0.5rem", fontWeight:600 }}>🧠 AI 分析：</div>
          <div style={{ fontSize:"0.85rem", color:"#e2e8f0", lineHeight:1.7, background:"#0d1520", borderRadius:"8px", padding:"0.75rem" }}>{signal.ai_analysis}</div>
          <div style={{ fontSize:"0.85rem", color:"#94a3b8", marginBottom:"0.5rem", fontWeight:600, marginTop:"0.75rem" }}>📊 技術面：</div>
          <div style={{ fontSize:"0.8rem", color:"#64748b", lineHeight:1.6 }}>{signal.technical_summary}</div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [sub, setSub]           = useState<Sub>({ subscribed: false, markets: [] });
  const [market, setMarket]     = useState("ALL");
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState<{name:string;pic:string}|null>(null);

  const fetchData = useCallback(async () => {
    const [sigRes, statRes, subRes] = await Promise.all([
      fetch(`/api/signals?market=${market}&limit=30`).then(r => r.json()).catch(() => ({ signals: [] })),
      fetch("/api/stats").then(r => r.json()).catch(() => ({})),
      fetch("/api/subscribe").then(r => r.json()).catch(() => ({ subscribed: false, markets: [] })),
    ]);
    setSignals(sigRes.signals || []);
    setStats(statRes);
    setSub(subRes);
    setLoading(false);
  }, [market]);

  useEffect(() => {
    // 從 cookie 取用戶資訊
    const getCookie = (name: string) => document.cookie.split(";").find(c => c.trim().startsWith(name + "="))?.split("=")[1];
    const name = getCookie("display_name");
    const pic  = getCookie("picture_url");
    if (name) setUser({ name: decodeURIComponent(name), pic: pic ? decodeURIComponent(pic) : "" });
    fetchData();
  }, [fetchData]);

  const toggleSubscribe = async () => {
    const newState = !sub.subscribed;
    setSub(prev => ({ ...prev, subscribed: newState }));
    await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscribed: newState }) });
  };

  const toggleMarket = async (m: string) => {
    const newMarkets = sub.markets.includes(m) ? sub.markets.filter(x => x !== m) : [...sub.markets, m];
    setSub(prev => ({ ...prev, markets: newMarkets }));
    await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: newMarkets }) });
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a" }}>
      {/* Navbar */}
      <nav style={{ borderBottom:"1px solid #1e2d45", padding:"1rem 2rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"1.8rem" }}>🐸</span>
          <div>
            <div style={{ fontWeight:700, color:"#e2e8f0" }}>呱呱投資俱樂部</div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.75rem" }}>
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#00ff88", animation:"none" }}></span>
              <span style={{ color:"#00ff88" }}>AI 即時監控中</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
              {user.pic && <img src={user.pic} alt="" style={{ width:32, height:32, borderRadius:"50%", border:"2px solid #06c755" }} />}
              <span style={{ color:"#e2e8f0", fontSize:"0.9rem" }}>{user.name}</span>
            </div>
          ) : (
            <a href="/" style={{ color:"#94a3b8", fontSize:"0.9rem", textDecoration:"none" }}>登入</a>
          )}
          <button onClick={() => fetchData()} style={{ background:"#1e2d45", color:"#94a3b8", border:"none", borderRadius:"8px", padding:"0.5rem 1rem", cursor:"pointer" }}>
            🔄 更新
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"2rem 1rem" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"1rem", marginBottom:"2rem" }}>
          <StatCard label="本週訊號"   value={stats?.signals_7d ?? "-"}   sub="過去 7 天" />
          <StatCard label="買進訊號"   value={stats?.buy_signals ?? "-"}   color="#00ff88" />
          <StatCard label="賣出訊號"   value={stats?.sell_signals ?? "-"}  color="#ff4444" />
          <StatCard label="歷史勝率"   value={stats ? `${stats.win_rate}%` : "-"} color={stats && stats.win_rate >= 50 ? "#00ff88" : "#ff4444"} />
          <StatCard label="累計損益"   value={stats ? `${stats.total_pnl > 0 ? "+" : ""}${stats.total_pnl}%` : "-"} color={stats && stats.total_pnl >= 0 ? "#00ff88" : "#ff4444"} />
          <StatCard label="訂閱用戶"   value={stats?.subscribers ?? "-"}   sub="LINE 推播人數" />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"1.5rem", alignItems:"start" }}>
          {/* Left: Signals */}
          <div>
            {/* Market Filter */}
            <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
              {MARKETS.map(m => (
                <button key={m} onClick={() => setMarket(m)}
                  style={{ background: market===m ? "#4f8ef7" : "#1e2d45", color: market===m ? "white" : "#94a3b8", border:"none", borderRadius:"8px", padding:"0.5rem 1rem", cursor:"pointer", fontWeight: market===m ? 700 : 400, transition:"all 0.2s" }}>
                  {m === "ALL" ? "全部" : MARKET_LABEL[m] || m}
                </button>
              ))}
            </div>

            {/* Signals List */}
            {loading ? (
              <div style={{ textAlign:"center", color:"#475569", padding:"3rem" }}>⏳ 載入中...</div>
            ) : signals.length === 0 ? (
              <div style={{ textAlign:"center", color:"#475569", padding:"3rem", background:"#111827", borderRadius:"12px", border:"1px solid #1e2d45" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>🤖</div>
                <div>AI 正在分析市場，訊號即將產生</div>
                <div style={{ fontSize:"0.85rem", marginTop:"0.5rem" }}>執行 <code style={{ color:"#4f8ef7" }}>python main.py once</code> 立即產生訊號</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                {signals.map(s => <SignalCard key={s.id} signal={s} />)}
              </div>
            )}
          </div>

          {/* Right: Settings + Review */}
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {/* Subscription */}
            <div style={{ background:"#111827", border:"1px solid #1e2d45", borderRadius:"12px", padding:"1.25rem" }}>
              <div style={{ fontWeight:700, color:"#e2e8f0", marginBottom:"1rem" }}>🔔 LINE 推播設定</div>
              {user ? (
                <>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                    <span style={{ color:"#94a3b8", fontSize:"0.9rem" }}>接收推播</span>
                    <button onClick={toggleSubscribe}
                      style={{ background: sub.subscribed ? "#06c755" : "#1e2d45", color:"white", border:"none", borderRadius:"20px", padding:"0.4rem 1.2rem", cursor:"pointer", fontWeight:600, fontSize:"0.85rem" }}>
                      {sub.subscribed ? "✓ 已訂閱" : "訂閱"}
                    </button>
                  </div>
                  <div style={{ color:"#94a3b8", fontSize:"0.85rem", marginBottom:"0.75rem" }}>接收市場：</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0.5rem" }}>
                    {["TW","US","FUTURES","CRYPTO"].map(m => (
                      <button key={m} onClick={() => toggleMarket(m)}
                        style={{ background: sub.markets.includes(m) ? "#4f8ef722" : "#1e2d45", color: sub.markets.includes(m) ? "#4f8ef7" : "#94a3b8", border: sub.markets.includes(m) ? "1px solid #4f8ef7" : "1px solid #1e2d45", borderRadius:"6px", padding:"0.3rem 0.75rem", cursor:"pointer", fontSize:"0.8rem" }}>
                        {MARKET_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign:"center", padding:"1rem" }}>
                  <a href="/" style={{ background:"#06c755", color:"white", padding:"0.6rem 1.5rem", borderRadius:"8px", textDecoration:"none", fontWeight:600 }}>
                    LINE 登入後訂閱
                  </a>
                </div>
              )}
            </div>

            {/* AI Review */}
            {stats?.latest_review && (
              <div style={{ background:"#111827", border:"1px solid #1e2d45", borderRadius:"12px", padding:"1.25rem" }}>
                <div style={{ fontWeight:700, color:"#e2e8f0", marginBottom:"1rem" }}>🧠 最新 AI 復盤</div>
                <div style={{ fontSize:"0.85rem", color:"#94a3b8", lineHeight:1.7 }}>
                  {String(stats.latest_review.market_assessment || "").substring(0, 120)}
                </div>
                {Boolean(stats.latest_review.risk_warning) && (
                  <div style={{ marginTop:"0.75rem", background:"rgba(255,68,68,0.1)", border:"1px solid rgba(255,68,68,0.3)", borderRadius:"8px", padding:"0.5rem 0.75rem", fontSize:"0.8rem", color:"#ff4444" }}>
                    ⚠️ {String(stats.latest_review.risk_warning as string)}
                  </div>
                )}
              </div>
            )}

            {/* Market Overview */}
            <div style={{ background:"#111827", border:"1px solid #1e2d45", borderRadius:"12px", padding:"1.25rem" }}>
              <div style={{ fontWeight:700, color:"#e2e8f0", marginBottom:"1rem" }}>📊 本週訊號分布</div>
              {stats?.by_market && Object.entries(stats.by_market).map(([m, cnt]) => (
                <div key={m} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <span style={{ color:"#94a3b8", fontSize:"0.85rem" }}>{MARKET_LABEL[m] || m}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                    <div style={{ background:"#1e2d45", borderRadius:"4px", height:6, width:60 }}>
                      <div style={{ background:"#4f8ef7", borderRadius:"4px", height:6, width: `${Math.min(100, (cnt as number) / (stats.signals_7d || 1) * 100)}%` }}></div>
                    </div>
                    <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:"0.85rem" }}>{cnt as number}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
