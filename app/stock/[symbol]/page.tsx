"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LightweightChart from "@/components/LightweightChart";

const STOCK_NAMES: Record<string, string> = {
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2412": "中華電",
  "2308": "台達電", "2882": "國泰金", "2891": "中信金", "2886": "兆豐金",
  "2881": "富邦金", "1301": "台塑", "1303": "南亞", "2002": "中鋼",
  "2303": "聯電", "3711": "日月光投控", "2357": "華碩", "2382": "廣達",
  "3034": "聯詠", "2379": "瑞昱", "2337": "旺宏", "2344": "華邦電",
  "4938": "和碩", "3231": "緯創", "2301": "光寶科", "2327": "國巨",
  "2603": "長榮", "2615": "萬海", "2609": "陽明", "2610": "華航",
  "2618": "長榮航", "5347": "世界先進", "6770": "力積電",
  "2884": "玉山金", "2880": "華南金", "2892": "第一金", "1326": "台化",
  "0050": "元大台灣50", "0056": "元大高股息", "00878": "國泰永續高股息",
  "4166": "亞諾法", "4743": "合一", "4968": "立積", "6446": "藥華藥",
  "2912": "統一超", "3045": "台灣大哥大", "2474": "可成",
  "NVDA": "NVIDIA", "TSLA": "Tesla", "AAPL": "Apple", "MSFT": "Microsoft",
  "AMZN": "Amazon", "GOOGL": "Alphabet", "META": "Meta", "AMD": "AMD",
  "INTC": "Intel", "NFLX": "Netflix", "AVGO": "Broadcom", "PLTR": "Palantir",
  "SMCI": "SuperMicro", "TSM": "台積電ADR", "QCOM": "Qualcomm",
  "ES=F": "S&P500期貨", "NQ=F": "那斯達克期貨", "GC=F": "黃金期貨", "CL=F": "原油期貨",
  "BTC-USD": "比特幣", "ETH-USD": "以太幣", "SOL-USD": "Solana",
  "BNB-USD": "BNB", "XRP-USD": "XRP", "ADA-USD": "Cardano",
};

// Popular TW stocks for quick search
const TW_POPULAR = [
  { sym: "2330", name: "台積電" }, { sym: "2317", name: "鴻海" },
  { sym: "2454", name: "聯發科" }, { sym: "2382", name: "廣達" },
  { sym: "3711", name: "日月光" }, { sym: "2303", name: "聯電" },
  { sym: "2882", name: "國泰金" }, { sym: "2603", name: "長榮" },
  { sym: "2618", name: "長榮航" }, { sym: "2337", name: "旺宏" },
  { sym: "1301", name: "台塑" }, { sym: "2912", name: "統一超" },
];

type Signal = {
  id: number; symbol: string; market: string; signal_type: string;
  confidence: number; price: number; stop_loss: number;
  target_price: number; reasoning: string; technical_score: number;
  sentiment_score: number; created_at: string;
  chip_score?: number; ml_score?: number;
};

type PriceInfo = {
  price: number; change: number; changePercent: number; name: string;
};

type ChipData = {
  foreign_net?: number;
  trust_net?: number;
  dealer_net?: number;
  margin_buy?: number;
  short_sell?: number;
  foreign_hold_pct?: number;
};

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol as string);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [market, setMarket] = useState("US");
  const [loading, setLoading] = useState(true);
  const [chipData, setChipData] = useState<ChipData | null>(null);
  const [activeTab, setActiveTab] = useState<"chart" | "analysis" | "chip" | "history">("chart");

  // Search state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ sym: string; name: string }[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const MARKET_LABEL: Record<string, string> = {
    TW: "🇹🇼 台股", US: "🇺🇸 美股", FUTURES: "📊 期貨", CRYPTO: "🪙 加密",
  };
  const MARKET_COLOR: Record<string, string> = {
    TW: "var(--tw)", US: "var(--us)", FUTURES: "var(--futures)", CRYPTO: "var(--crypto)",
  };

  // Search handler
  const handleSearch = (q: string) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const ql = q.toLowerCase();
    const matches = Object.entries(STOCK_NAMES)
      .filter(([sym, name]) =>
        sym.toLowerCase().includes(ql) || name.toLowerCase().includes(ql)
      )
      .slice(0, 8)
      .map(([sym, name]) => ({ sym, name }));
    setSearchResults(matches);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const sigRes = await fetch(`/api/signals?symbol=${symbol}&limit=20`).then(r => r.json()).catch(() => ({ signals: [] }));
      const sigs: Signal[] = sigRes.signals || [];
      setSignals(sigs);

      const detectedMarket = sigs[0]?.market || (
        /^\d{4,6}/.test(symbol) ? "TW"
          : symbol.includes("=F") ? "FUTURES"
          : symbol.includes("-USD") ? "CRYPTO" : "US"
      );
      setMarket(detectedMarket);

      const priceRes = await fetch(`/api/prices?symbols=${symbol}&markets=${detectedMarket}`)
        .then(r => r.json()).catch(() => ({ prices: {} }));
      const pd = priceRes.prices?.[symbol];
      if (pd) setPriceInfo(pd);

      // Chip data for TW stocks
      if (detectedMarket === "TW") {
        const chipRes = await fetch(`/api/chip?symbol=${symbol}`).then(r => r.json()).catch(() => ({}));
        if (chipRes && Object.keys(chipRes).length > 0) setChipData(chipRes);
      }

      setLoading(false);
    }
    load();
  }, [symbol]);

  const latestSignal = signals[0];
  const stockName = STOCK_NAMES[symbol] || priceInfo?.name || "";

  // Display name: TW → "台積電 (2330)", others → "AAPL · Apple"
  const displayTitle = market === "TW" && stockName
    ? `${stockName} (${symbol})`
    : stockName ? `${symbol} · ${stockName}` : symbol;

  const formatPrice = (p: number) => {
    if (!p || p <= 0) return "-";
    return market === "TW"
      ? p.toLocaleString("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
      : market === "CRYPTO"
      ? p > 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${p.toFixed(4)}`
      : p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Signal markers for chart
  const signalMarkers = signals.map(s => ({
    time: s.created_at,
    signal_type: s.signal_type,
    price: s.price,
  }));

  const confPct = (v: number) => Math.round(v >= 1 ? v : v * 100);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,16,10,0.96)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1rem", height: 56,
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        <Link href="/dashboard" style={{ color: "var(--t3)", textDecoration: "none", fontSize: "0.85rem", flexShrink: 0 }}>← 返回</Link>
        <span style={{ color: "var(--border)", flexShrink: 0 }}>|</span>
        <span style={{ color: "var(--t1)", fontWeight: 700, fontSize: "0.95rem", flexShrink: 0, maxWidth: "35vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayTitle}
        </span>
        {market && (
          <span style={{ fontSize: "0.72rem", color: MARKET_COLOR[market], background: `${MARKET_COLOR[market]}18`, padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>
            {MARKET_LABEL[market]}
          </span>
        )}

        {/* ── Search bar ── */}
        <div style={{ flex: 1, position: "relative", maxWidth: 320 }}>
          <input
            ref={searchRef}
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setSearchResults([]), 180)}
            placeholder="🔍 搜尋台股 / 美股代號或名稱"
            style={{
              width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)",
              color: "var(--t1)", borderRadius: 8, padding: "0.35rem 0.75rem",
              fontSize: "0.82rem", outline: "none", minHeight: 34,
            }}
          />
          {searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, zIndex: 100, overflow: "hidden", boxShadow: "0 8px 24px #000a",
            }}>
              {searchResults.map(r => (
                <button key={r.sym}
                  onMouseDown={() => { router.push(`/stock/${r.sym}`); setSearchQ(""); setSearchResults([]); }}
                  style={{
                    width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--border)",
                    padding: "0.6rem 0.9rem", cursor: "pointer", textAlign: "left",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                  <span style={{ color: "var(--t1)", fontSize: "0.88rem", fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: "var(--t3)", fontSize: "0.78rem" }}>{r.sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem" }}>

        {/* ── Price Header ── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "1rem 1.25rem", marginBottom: "1rem",
          display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginBottom: "0.2rem" }}>最新價格</div>
            <div style={{ fontSize: "clamp(1.7rem,5vw,2.6rem)", fontWeight: 800, color: "var(--t1)", lineHeight: 1 }}>
              {loading ? "—" : formatPrice(priceInfo?.price || 0)}
            </div>
            {market === "TW" && <div style={{ fontSize: "0.72rem", color: "var(--t3)", marginTop: "0.2rem" }}>台幣 NTD</div>}
          </div>
          {priceInfo && priceInfo.price > 0 && (
            <div>
              <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginBottom: "0.2rem" }}>今日漲跌</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: priceInfo.changePercent >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {priceInfo.changePercent >= 0 ? "▲" : "▼"} {Math.abs(priceInfo.changePercent).toFixed(2)}%
              </div>
              <div style={{ fontSize: "0.82rem", color: priceInfo.change >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {priceInfo.change >= 0 ? "+" : ""}{formatPrice(priceInfo.change)}
              </div>
            </div>
          )}
          {/* Quick picks from popular TW */}
          {market === "TW" && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginLeft: "auto" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--t3)", alignSelf: "center" }}>快速切換：</span>
              {TW_POPULAR.filter(p => p.sym !== symbol).slice(0, 5).map(p => (
                <Link key={p.sym} href={`/stock/${p.sym}`}
                  style={{ fontSize: "0.72rem", color: "var(--tw)", background: "var(--tw)18", borderRadius: 5, padding: "2px 7px", textDecoration: "none" }}>
                  {p.name}
                </Link>
              ))}
            </div>
          )}
          {/* AI badge */}
          {latestSignal && (
            <div style={{
              background: latestSignal.signal_type === "BUY" ? "rgba(34,197,94,0.12)" : latestSignal.signal_type === "SELL" ? "rgba(244,63,94,0.12)" : "rgba(148,163,184,0.12)",
              borderRadius: 10, padding: "0.6rem 1rem", textAlign: "center",
            }}>
              <div style={{ color: "var(--t3)", fontSize: "0.7rem", marginBottom: "0.2rem" }}>AI 建議</div>
              <div style={{
                fontSize: "1rem", fontWeight: 800,
                color: latestSignal.signal_type === "BUY" ? "var(--buy)" : latestSignal.signal_type === "SELL" ? "var(--sell)" : "var(--hold)",
              }}>
                {latestSignal.signal_type === "BUY" ? "🟢 買進" : latestSignal.signal_type === "SELL" ? "🔴 賣出" : "⚖️ 觀望"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--t3)" }}>信心度 {confPct(latestSignal.confidence)}%</div>
            </div>
          )}
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1rem", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {[
            { key: "chart",    label: "📈 K線圖" },
            { key: "analysis", label: "🧠 AI分析" },
            { key: "chip",     label: "🏦 籌碼" },
            { key: "history",  label: "📋 訊號歷史" },
          ].map(t => (
            <button key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`tab ${activeTab === t.key ? "active" : ""}`}
              style={{ fontSize: "0.85rem" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CHART TAB ── */}
        {activeTab === "chart" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "1rem" }} className="stock-grid">
            <div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: "1rem" }}>
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: "0.88rem" }}>📈 技術K線 · {market === "TW" ? `${stockName} (${symbol})` : symbol}</span>
                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.7rem" }}>
                    <span style={{ color: "#22c55e" }}>▲ 買進點</span>
                    <span style={{ color: "#f43f5e" }}>▼ 賣出點</span>
                  </div>
                </div>
                <LightweightChart symbol={symbol} market={market} height={460} signals={signalMarkers} />
              </div>

              {/* Technical score bar */}
              {latestSignal && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.75rem", fontSize: "0.88rem" }}>📊 技術指標評分</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {[
                      { label: "技術面", score: (latestSignal.technical_score + 1) / 2, color: "var(--tw)" },
                      { label: "情緒面", score: (latestSignal.sentiment_score + 1) / 2, color: "var(--us)" },
                      { label: "綜合信心", score: latestSignal.confidence >= 1 ? latestSignal.confidence / 100 : latestSignal.confidence, color: "var(--green)" },
                    ].map(item => {
                      const pct = Math.round(Math.max(0, Math.min(1, item.score)) * 100);
                      return (
                        <div key={item.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.2rem" }}>
                            <span style={{ color: "var(--t3)" }}>{item.label}</span>
                            <span style={{ color: item.color, fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar: operation box */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {latestSignal && latestSignal.price > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.75rem", fontSize: "0.88rem" }}>🎯 操作區間</div>
                  {[
                    { label: "建議進場", value: latestSignal.price, color: "var(--t1)", desc: "AI 建議進場價" },
                    { label: "🎯 止盈目標", value: latestSignal.target_price, color: "var(--buy)", desc: `+${latestSignal.price > 0 ? ((latestSignal.target_price - latestSignal.price) / latestSignal.price * 100).toFixed(1) : 0}%` },
                    { label: "🛑 止損設定", value: latestSignal.stop_loss, color: "var(--sell)", desc: `${latestSignal.price > 0 ? ((latestSignal.stop_loss - latestSignal.price) / latestSignal.price * 100).toFixed(1) : 0}%` },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.6rem 0.75rem", marginBottom: "0.4rem",
                      background: "var(--bg)", borderRadius: 8,
                      borderLeft: `2px solid ${item.color}`,
                    }}>
                      <div>
                        <div style={{ fontSize: "0.78rem", color: "var(--t3)" }}>{item.label}</div>
                        <div style={{ fontSize: "0.7rem", color: item.color, opacity: 0.85 }}>{item.desc}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: item.color }}>
                        {item.value > 0 ? item.value.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Related TW picks */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
                <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.75rem", fontSize: "0.88rem" }}>🔗 同類台股快速查</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {TW_POPULAR.filter(p => p.sym !== symbol).slice(0, 7).map(p => (
                    <Link key={p.sym} href={`/stock/${p.sym}`}
                      style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 0.6rem", background: "var(--bg)", borderRadius: 7, textDecoration: "none", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--t1)", fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: "var(--t3)" }}>{p.sym}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYSIS TAB ── */}
        {activeTab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {latestSignal ? (
              <>
                {/* Step-by-step AI reasoning */}
                {[
                  { label: "📥 資料抓取", color: "var(--green)", text: `抓取 ${market === "TW" ? stockName : symbol} 近 6 個月 K 線數據（嚴格過濾 1 年以上舊資料）` },
                  { label: "📊 技術面分析", color: "var(--tw)", score: Math.round((latestSignal.technical_score + 1) / 2 * 100), text: latestSignal.reasoning ? latestSignal.reasoning.substring(0, 200) : `技術評分 ${Math.round((latestSignal.technical_score + 1) / 2 * 100)}% | MACD/RSI/布林帶/ADX/均線` },
                  { label: "🏦 籌碼面分析", color: "var(--us)", score: confPct(latestSignal.confidence), text: market === "TW" ? "外資/投信/自營商買賣超 · 融資融券異動 · 法人集中度" : market === "CRYPTO" ? "鏈上數據 · 巨鯨動向 · 交易所淨流量" : "機構持股 · 期貨未平倉 · Put/Call比" },
                  { label: "📰 消息面情緒", color: "var(--futures)", score: Math.round(Math.abs(latestSignal.sentiment_score) * 100), text: latestSignal.sentiment_score > 0.1 ? "近期新聞偏正面，市場情緒樂觀" : latestSignal.sentiment_score < -0.1 ? "近期新聞偏負面，注意下行風險" : "消息面中性，無重大利多利空" },
                  { label: "🧠 Claude AI 深度綜合", color: "var(--crypto)", text: latestSignal.reasoning || "Claude Sonnet 綜合技術面、籌碼面、消息面進行深度推理判斷" },
                  { label: latestSignal.signal_type === "BUY" ? "🟢 最終判斷：買進" : latestSignal.signal_type === "SELL" ? "🔴 最終判斷：賣出" : "⚖️ 最終判斷：觀望", color: latestSignal.signal_type === "BUY" ? "var(--buy)" : latestSignal.signal_type === "SELL" ? "var(--sell)" : "var(--hold)", text: `進場 ${formatPrice(latestSignal.price)} | 止盈 ${formatPrice(latestSignal.target_price)} | 止損 ${formatPrice(latestSignal.stop_loss)} | 信心度 ${confPct(latestSignal.confidence)}%` },
                ].map((step, i) => (
                  <div key={i} style={{
                    background: "var(--bg-card)",
                    borderTop: `1px solid ${step.color}33`,
                    borderRight: `1px solid ${step.color}33`,
                    borderBottom: `1px solid ${step.color}33`,
                    borderLeft: `3px solid ${step.color}`,
                    borderRadius: 12, padding: "0.9rem 1rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontWeight: 700, color: step.color, fontSize: "0.9rem" }}>{step.label}</span>
                      {step.score !== undefined && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ width: 70, height: 5, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${step.score}%`, height: "100%", background: step.color, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: "0.72rem", color: step.color, fontWeight: 700 }}>{step.score}%</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.83rem", color: "var(--t2)", lineHeight: 1.65 }}>{step.text}</div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--t3)" }}>
                <div style={{ fontSize: "2rem" }}>🔍</div>
                <div>此標的尚無 AI 分析記錄</div>
              </div>
            )}
          </div>
        )}

        {/* ── CHIP TAB ── */}
        {activeTab === "chip" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {market === "TW" ? (
              <>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.85rem", fontSize: "0.88rem" }}>🏦 法人買賣動向</div>
                  {chipData ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {[
                        { label: "外資買賣超", value: chipData.foreign_net, unit: "張", color: (chipData.foreign_net || 0) >= 0 ? "var(--buy)" : "var(--sell)" },
                        { label: "投信買賣超", value: chipData.trust_net, unit: "張", color: (chipData.trust_net || 0) >= 0 ? "var(--buy)" : "var(--sell)" },
                        { label: "自營商買賣超", value: chipData.dealer_net, unit: "張", color: (chipData.dealer_net || 0) >= 0 ? "var(--buy)" : "var(--sell)" },
                        { label: "融資餘額", value: chipData.margin_buy, unit: "張", color: "var(--t2)" },
                        { label: "融券餘額", value: chipData.short_sell, unit: "張", color: "var(--t2)" },
                        { label: "外資持股比", value: chipData.foreign_hold_pct, unit: "%", color: "var(--tw)" },
                      ].filter(item => item.value !== undefined && item.value !== null).map(item => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0.75rem", background: "var(--bg)", borderRadius: 8 }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--t3)" }}>{item.label}</span>
                          <span style={{ fontWeight: 700, color: item.color, fontSize: "0.9rem" }}>
                            {item.value! >= 0 ? "+" : ""}{item.value?.toLocaleString()}{item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.83rem", color: "var(--t3)", lineHeight: 1.7 }}>
                      <div style={{ marginBottom: "0.75rem" }}>籌碼資料需串接 FinMind API。</div>
                      <div style={{ background: "var(--bg)", borderRadius: 8, padding: "0.75rem", fontSize: "0.78rem" }}>
                        💡 設定 <code style={{ color: "var(--green)" }}>FINMIND_TOKEN</code> 於 .env 即可啟用法人籌碼數據
                      </div>
                      {latestSignal && (
                        <div style={{ marginTop: "0.75rem" }}>
                          <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: "0.4rem" }}>AI 籌碼面評估：</div>
                          <div style={{ color: "var(--t1)", lineHeight: 1.7 }}>
                            根據近期技術指標走勢與市場訊號判斷，{symbol} 籌碼面評估分數為 <span style={{ color: "var(--green)", fontWeight: 700 }}>{confPct(latestSignal.confidence)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.75rem", fontSize: "0.88rem" }}>📈 多維評分</div>
                  {latestSignal && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {[
                        { label: "技術面評分", pct: Math.round((latestSignal.technical_score + 1) / 2 * 100), color: "var(--tw)", weight: "25%" },
                        { label: "籌碼面評分", pct: confPct(latestSignal.confidence), color: "var(--us)", weight: "30%" },
                        { label: "情緒面評分", pct: Math.round((latestSignal.sentiment_score + 1) / 2 * 100), color: "var(--futures)", weight: "20%" },
                        { label: "ML 模型預測", pct: confPct(latestSignal.confidence), color: "var(--green)", weight: "25%" },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
                            <span style={{ color: "var(--t3)" }}>{item.label}</span>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <span style={{ color: "var(--t4)", fontSize: "0.68rem" }}>權重{item.weight}</span>
                              <span style={{ color: item.color, fontWeight: 700 }}>{item.pct}%</span>
                            </div>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.75rem" }}>
                  {market === "CRYPTO" ? "🔗 鏈上數據" : "📊 機構動向"}
                </div>
                <div style={{ color: "var(--t3)", fontSize: "0.83rem", lineHeight: 1.7 }}>
                  {market === "CRYPTO"
                    ? "加密貨幣鏈上數據：巨鯨地址持倉、交易所淨流入/出、網絡活躍度分析"
                    : "機構買賣動向、做空比例、選擇權未平倉量分析"}
                </div>
                {latestSignal && (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {[
                      { label: "AI 綜合評分", pct: confPct(latestSignal.confidence), color: "var(--green)" },
                      { label: "技術面", pct: Math.round((latestSignal.technical_score + 1) / 2 * 100), color: "var(--tw)" },
                      { label: "情緒面", pct: Math.round((latestSignal.sentiment_score + 1) / 2 * 100), color: "var(--us)" },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.2rem" }}>
                          <span style={{ color: "var(--t3)" }}>{item.label}</span>
                          <span style={{ color: item.color, fontWeight: 700 }}>{item.pct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SIGNAL HISTORY TAB ── */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--t3)", marginBottom: "0.25rem" }}>
              共 {signals.length} 筆 AI 訊號記錄（以台股為主要分析重心）
            </div>
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
            ) : signals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--t3)" }}>
                <div style={{ fontSize: "2rem" }}>📭</div>
                <div>此標的尚無訊號記錄</div>
              </div>
            ) : (
              signals.map(sig => {
                const sigName = STOCK_NAMES[sig.symbol] || sig.symbol;
                return (
                  <div key={sig.id} style={{
                    background: "var(--bg-card)",
                    borderTop: `1px solid ${sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)"}33`,
                    borderRight: `1px solid ${sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)"}33`,
                    borderBottom: `1px solid ${sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)"}33`,
                    borderLeft: `3px solid ${sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)"}`,
                    borderRadius: 12, padding: "0.85rem 1rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{
                          fontWeight: 700, fontSize: "0.92rem",
                          color: sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)",
                        }}>
                          {sig.signal_type === "BUY" ? "🟢 買進" : sig.signal_type === "SELL" ? "🔴 賣出" : "⚖️ 觀望"}
                        </span>
                        {sig.market === "TW" && sigName !== sig.symbol && (
                          <span style={{ fontSize: "0.78rem", color: "var(--t3)" }}>{sigName}</span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: sig.confidence >= 0.6 ? "var(--green)" : "var(--hold)", fontWeight: 600 }}>
                          {confPct(sig.confidence)}%
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--t3)" }}>
                        {new Date(sig.created_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.4rem", marginBottom: "0.5rem" }}>
                      {[
                        { label: "進場", value: sig.price, color: "var(--t1)" },
                        { label: "🎯 止盈", value: sig.target_price, color: "var(--buy)" },
                        { label: "🛑 止損", value: sig.stop_loss, color: "var(--sell)" },
                      ].map(p => (
                        <div key={p.label} style={{ textAlign: "center", background: "var(--bg)", borderRadius: 7, padding: "0.35rem" }}>
                          <div style={{ fontSize: "0.65rem", color: "var(--t3)" }}>{p.label}</div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: p.color }}>
                            {p.value > 0 ? p.value.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                    {sig.reasoning && (
                      <div style={{ fontSize: "0.78rem", color: "var(--t3)", lineHeight: 1.6 }}>
                        {sig.reasoning.substring(0, 160)}{sig.reasoning.length > 160 ? "..." : ""}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
