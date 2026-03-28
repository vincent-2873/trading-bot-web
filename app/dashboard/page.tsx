"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const LightweightChart = dynamic(() => import("@/components/LightweightChart"), { ssr: false });

/* ── Types ── */
type Signal = {
  id: number; symbol: string; market: string; signal_type: string;
  confidence: number; price: number; stop_loss: number;
  target_price: number; reasoning: string; technical_score: number;
  sentiment_score: number; created_at: string;
  // legacy aliases (frontend compat)
  signal_strength?: number; entry_price?: number; take_profit?: number;
  ai_analysis?: string; technical_summary?: string; news_sentiment?: string;
  invest_style?: string;
};
type Stats = {
  signals_7d: number; buy_signals: number; sell_signals: number;
  by_market: Record<string, number>; win_rate: number; total_trades: number;
  total_pnl: number; subscribers: number;
  latest_review: Record<string, unknown> | null;
};
type Sub = { subscribed: boolean; markets: string[] };
type NewsItem = {
  id: string; title: string; url: string; source: string;
  description?: string; published_at: string;
  sentiment: string; sentiment_score?: number;
  industry?: string;
};
type CryptoCoinsType = {
  id: string; symbol: string; name: string;
  price: number; change_1h: number; change_24h: number; change_7d: number;
  market_cap: number; volume_24h: number; image: string;
  ath: number; ath_change_pct: number;
};

/* ── Constants ── */
const MARKETS = ["TW", "ALL", "US", "FUTURES", "CRYPTO"];
const MARKET_LABEL: Record<string, string> = {
  TW: "🇹🇼 台股", US: "🇺🇸 美股", FUTURES: "📊 期貨", CRYPTO: "🪙 加密",
};
const MARKET_COLOR: Record<string, string> = {
  TW: "var(--tw)", US: "var(--us)", FUTURES: "var(--futures)", CRYPTO: "var(--crypto)",
};
const SIG_COLOR: Record<string, string> = {
  BUY: "var(--buy)", SELL: "var(--sell)", HOLD: "var(--hold)",
};
const SENT_LABEL: Record<string, string> = {
  POSITIVE: "📈 正面", NEGATIVE: "📉 負面", NEUTRAL: "➡️ 中性",
};
const INDUSTRY_TABS = ["全部", "半導體", "科技", "金融", "能源", "加密貨幣", "電動車", "總經", "台股"];

// Stock name lookup
const STOCK_NAMES: Record<string, string> = {
  // 台股
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2412": "中華電",
  "2308": "台達電", "2882": "國泰金", "2891": "中信金", "2886": "兆豐金",
  "2881": "富邦金", "1301": "台塑", "1303": "南亞", "2002": "中鋼",
  "2303": "聯電", "3711": "日月光投控", "2357": "華碩", "2382": "廣達",
  "3034": "聯詠", "2379": "瑞昱", "2337": "旺宏", "2344": "華邦電",
  "4938": "和碩", "3231": "緯創", "2301": "光寶科", "2603": "長榮",
  "2615": "萬海", "2609": "陽明", "2610": "華航", "2618": "長榮航",
  "5347": "世界先進", "6770": "力積電", "2884": "玉山金", "2880": "華南金",
  "2883": "開發金", "1229": "聯華", "1326": "台化",
  "0050": "元大台灣50", "0056": "元大高股息", "00878": "國泰永續高股息",
  "00929": "復華台灣科技優息", "00919": "群益台灣精選高息", "006208": "富邦台50",
  "2892": "第一金", "3045": "台灣大哥大",
  "2474": "可成", "2376": "技嘉", "2912": "統一超",
  // 美股
  "NVDA": "NVIDIA", "TSLA": "Tesla", "AAPL": "Apple",
  "MSFT": "Microsoft", "AMZN": "Amazon", "GOOGL": "Alphabet",
  "META": "Meta", "AMD": "AMD", "INTC": "Intel",
  "NFLX": "Netflix", "UBER": "Uber",
  "TSM": "Taiwan Semi", "QCOM": "Qualcomm", "AVGO": "Broadcom",
  "ORCL": "Oracle", "CRM": "Salesforce", "COIN": "Coinbase",
  "PLTR": "Palantir", "SMCI": "SuperMicro",
  // 期貨
  "ES=F": "S&P500期貨", "NQ=F": "那斯達克期貨",
  "YM=F": "道瓊期貨", "RTY=F": "羅素2000",
  "GC=F": "黃金期貨", "CL=F": "原油期貨",
  // 加密
  "BTC-USD": "比特幣", "ETH-USD": "以太幣", "SOL-USD": "Solana", "BNB-USD": "BNB",
};

// Taiwan stock industries
const TW_INDUSTRIES = [
  { key: "semi",   label: "💻 半導體",    syms: ["2330","2454","2379","2303","3711","6770","2344","3034","2337","5347","2408"] },
  { key: "ai",     label: "🤖 AI伺服器",  syms: ["2382","2317","3231","4938","2308","2357","2301","2327"] },
  { key: "fin",    label: "🏦 金融",      syms: ["2882","2881","2886","2891","2884","2880","2892"] },
  { key: "ship",   label: "🚢 航運",      syms: ["2603","2615","2609","2610","2618"] },
  { key: "bio",    label: "💊 生技",      syms: ["4166","4743","4968","6446"] },
  { key: "trad",   label: "🏭 傳產",      syms: ["1301","1303","2002","1326","2912"] },
  { key: "telecom",label: "📡 電信",      syms: ["2412","3045"] },
];
const TW_SECTOR_FILTER = ["全部", "半導體", "AI伺服器", "金融", "航運", "生技", "傳產", "電信"];
// Map sector label to TW_INDUSTRIES key
const TW_SECTOR_KEY: Record<string, string> = {
  "半導體": "semi", "AI伺服器": "ai", "金融": "fin",
  "航運": "ship", "生技": "bio", "傳產": "trad", "電信": "telecom",
};


/* ── Sub-components ── */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem 1.1rem" }}>
      <div style={{ color: "var(--t3)", fontSize: "0.75rem", marginBottom: "0.3rem", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 800, color: color || "var(--t1)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginTop: "0.25rem" }}>{sub}</div>}
    </div>
  );
}

function SignalCard({ signal, realtimePrice, onPaperTrade }: {
  signal: Signal;
  realtimePrice?: { price: number; change: number; changePercent: number; name: string };
  onPaperTrade?: (signal: Signal, price: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const sc = SIG_COLOR[signal.signal_type] || "var(--hold)";

  const entryPrice = signal.price || signal.entry_price || 0;
  const stopLoss = signal.stop_loss || 0;
  const takeProfit = signal.target_price || signal.take_profit || 0;
  const confidence = signal.confidence ?? signal.signal_strength ?? 0;
  const analysis = signal.reasoning || signal.ai_analysis || "";
  const techSummary = signal.technical_summary || `技術評分: ${((signal.technical_score || 0) * 100).toFixed(0)}%`;
  const sentiment = signal.news_sentiment || (signal.sentiment_score && signal.sentiment_score > 0 ? "POSITIVE" : signal.sentiment_score && signal.sentiment_score < 0 ? "NEGATIVE" : "NEUTRAL");
  const sl_pct = entryPrice > 0 ? ((stopLoss - entryPrice) / entryPrice * 100).toFixed(1) : "0";
  const tp_pct = entryPrice > 0 ? ((takeProfit - entryPrice) / entryPrice * 100).toFixed(1) : "0";
  const stockName = STOCK_NAMES[signal.symbol] || "";

  // 格式化價格（台股整數，美股兩位小數）
  const fmtPrice = (p: number) => {
    if (!p || p <= 0) return "-";
    return signal.market === "TW"
      ? p.toLocaleString("zh-TW", { maximumFractionDigits: 2 })
      : p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div
      className="fade-up"
      style={{
        background: "var(--bg-card)",
        borderTop: `1px solid ${expanded ? sc + "44" : "var(--border)"}`,
        borderRight: `1px solid ${expanded ? sc + "44" : "var(--border)"}`,
        borderBottom: `1px solid ${expanded ? sc + "44" : "var(--border)"}`,
        borderLeft: `3px solid ${sc}`,
        borderRadius: 14, padding: "1.1rem", cursor: "pointer", transition: "all .2s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {/* Symbol + Name — click goes to detail page */}
          <button
            onClick={() => router.push(`/stock/${encodeURIComponent(signal.symbol)}`)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "baseline", gap: "0.35rem",
            }}
          >
            {signal.market === "TW" && stockName ? (
              <>
                <span style={{ fontSize: "clamp(0.95rem,2.5vw,1.2rem)", fontWeight: 800, color: "var(--t1)" }}>{stockName}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--t3)", fontWeight: 500 }}>({signal.symbol})</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "clamp(1rem,2.5vw,1.3rem)", fontWeight: 800, color: "var(--t1)" }}>{signal.symbol}</span>
                {stockName && <span style={{ fontSize: "0.78rem", color: "var(--t3)", fontWeight: 500 }}>{stockName}</span>}
              </>
            )}
          </button>
          <span className={`badge badge-${signal.signal_type.toLowerCase()}`}>{signal.signal_type}</span>
          <span style={{
            fontSize: "0.75rem", color: MARKET_COLOR[signal.market] || "var(--t3)",
            background: `${MARKET_COLOR[signal.market] || "var(--t3)"}18`,
            padding: "2px 8px", borderRadius: 6,
          }}>{MARKET_LABEL[signal.market] || signal.market}</span>
          {/* Investor Style Tag */}
          {(() => {
            const TW_SHORT = ["2454","2337","6770","2344","3034","4166","4743","4968","6446"];
            const TW_LONG = ["2882","2881","2880","2892","2886","2412","3045","1301","1303","3008"];
            const style = signal.market === "CRYPTO" ? "短線"
              : TW_SHORT.includes(signal.symbol) ? "短線"
              : TW_LONG.includes(signal.symbol) ? "長線"
              : "中線";
            const styleColor = style === "短線" ? "#f97316" : style === "長線" ? "#60a5fa" : "#a3e635";
            return (
              <span style={{ fontSize: "0.65rem", color: styleColor, background: `${styleColor}18`,
                padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                {style}
              </span>
            );
          })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {/* Real-time price */}
          {realtimePrice && realtimePrice.price > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--t1)" }}>
                {signal.market === "TW"
                  ? realtimePrice.price.toLocaleString("zh-TW", { maximumFractionDigits: 2 })
                  : realtimePrice.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </div>
              <div style={{
                fontSize: "0.65rem", fontWeight: 600,
                color: realtimePrice.changePercent >= 0 ? "var(--buy)" : "var(--sell)",
              }}>
                {realtimePrice.changePercent >= 0 ? "▲" : "▼"}{Math.abs(realtimePrice.changePercent).toFixed(2)}%
              </div>
            </div>
          )}
          {/* Confidence */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: confidence >= 0.6 ? "var(--green)" : confidence >= 0.4 ? "var(--us)" : "var(--hold)" }}>
              {(confidence * 100).toFixed(0)}%
            </div>
            <div style={{ color: "var(--t3)", fontSize: "0.68rem" }}>信心度</div>
          </div>
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "var(--bg)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "0.25rem 0.5rem", cursor: "pointer",
              color: "var(--t3)", fontSize: "0.75rem", minHeight: 28,
            }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Price grid: 進場/止損(紅)/止盈(綠) */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", marginBottom: "0.75rem" }}
      >
        {[
          { label: "進場價", value: fmtPrice(entryPrice), color: "var(--t1)", bg: "var(--bg)" },
          { label: "🛑 止損", value: fmtPrice(stopLoss), pct: sl_pct, color: "#f43f5e", bg: "rgba(244,63,94,0.07)" },
          { label: "🎯 止盈", value: fmtPrice(takeProfit), pct: `+${tp_pct}`, color: "#22c55e", bg: "rgba(34,197,94,0.07)" },
        ].map(p => (
          <div key={p.label} style={{ textAlign: "center", background: p.bg, borderRadius: 8, padding: "0.4rem 0.3rem" }}>
            <div style={{ color: "var(--t3)", fontSize: "0.66rem" }}>{p.label}</div>
            <div style={{ color: p.color, fontWeight: 700, fontSize: "0.85rem" }}>{p.value}</div>
            {p.pct && <div style={{ color: p.color, fontSize: "0.67rem", opacity: 0.85 }}>({p.pct}%)</div>}
          </div>
        ))}
      </div>

      {/* Footer row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ fontSize: "0.77rem", color: "var(--t3)" }}>{SENT_LABEL[sentiment] || "➡️ 中性"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--t3)" }}>
            {new Date(signal.created_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          {(signal.signal_type === "BUY" || signal.signal_type === "SELL") && onPaperTrade && (
            <button onClick={(e) => { e.stopPropagation(); onPaperTrade(signal, entryPrice); }}
              style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 6,
                background: "#a3e63522", color: "#a3e635", border: "1px solid #a3e63540",
                cursor: "pointer" }}>
              🎮 模擬
            </button>
          )}
          <Link
            href={`/stock/${encodeURIComponent(signal.symbol)}`}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: "0.73rem", color: "var(--green)", textDecoration: "none",
              background: "rgba(34,197,94,0.1)", borderRadius: 5, padding: "2px 8px",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            詳細 →
          </Link>
        </div>
      </div>

      {/* Expanded AI Analysis */}
      {expanded && (
        <div style={{ marginTop: "0.9rem", borderTop: "1px solid var(--border)", paddingTop: "0.9rem", animation: "fadeUp .2s ease" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--t2)", fontWeight: 600, marginBottom: "0.4rem" }}>🧠 AI 選股理由</div>
          <div style={{ fontSize: "0.83rem", color: "var(--t1)", lineHeight: 1.7, background: "var(--bg)", borderRadius: 8, padding: "0.7rem" }}>
            {analysis || "AI 正在分析中..."}
          </div>
          {techSummary && (
            <>
              <div style={{ fontSize: "0.82rem", color: "var(--t2)", fontWeight: 600, marginBottom: "0.4rem", marginTop: "0.7rem" }}>📊 技術面</div>
              <div style={{ fontSize: "0.8rem", color: "var(--t3)", lineHeight: 1.6 }}>{techSummary}</div>
            </>
          )}
          <div style={{ marginTop: "0.8rem", textAlign: "center" }}>
            <Link
              href={`/stock/${encodeURIComponent(signal.symbol)}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                color: "var(--green-light)", background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8,
                padding: "0.45rem 1rem", textDecoration: "none", fontSize: "0.82rem", fontWeight: 600,
              }}
            >
              📈 查看完整線圖與分析
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const sentColor = item.sentiment === "POSITIVE" ? "var(--buy)"
    : item.sentiment === "NEGATIVE" ? "var(--sell)" : "var(--hold)";
  const sentEmoji = item.sentiment === "POSITIVE" ? "📈" : item.sentiment === "NEGATIVE" ? "📉" : "➡️";
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} 分鐘前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小時前`;
    return `${Math.floor(h / 24)} 天前`;
  };

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-card fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.4rem" }}>
        <div style={{ fontSize: "clamp(0.85rem,2vw,0.95rem)", color: "var(--t1)", fontWeight: 600, lineHeight: 1.45, flex: 1 }}>
          {item.title}
        </div>
        <span style={{ fontSize: "0.78rem", color: sentColor, background: `${sentColor}18`, padding: "2px 8px", borderRadius: 6, flexShrink: 0, fontWeight: 600 }}>
          {sentEmoji}
        </span>
      </div>
      {item.description && (
        <div style={{ fontSize: "0.8rem", color: "var(--t3)", lineHeight: 1.55, marginBottom: "0.5rem" }}>
          {item.description.substring(0, 120)}{item.description.length > 120 ? "..." : ""}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--t3)" }}>
        <span>📰 {item.source}</span>
        <span>{timeAgo(item.published_at)}</span>
      </div>
    </a>
  );
}

type PriceMap = Record<string, { price: number; change: number; changePercent: number; name: string }>;

// 四象限大盤指數設定
const MARKET_INDICES = [
  { symbol: "^TWII",   tvSymbol: "TWSE:TAIEX",         name: "台灣加權指數", market: "TW",      emoji: "🇹🇼", color: "var(--tw)" },
  { symbol: "^GSPC",   tvSymbol: "SP:SPX",              name: "S&P 500",     market: "US",      emoji: "🇺🇸", color: "var(--us)" },
  { symbol: "NQ=F",    tvSymbol: "CME_MINI:NQ1!",       name: "那斯達克期貨", market: "FUTURES", emoji: "📊", color: "var(--futures)" },
  { symbol: "BTC-USD", tvSymbol: "BINANCE:BTCUSDT",     name: "比特幣",       market: "CRYPTO",  emoji: "🪙", color: "var(--crypto)" },
];

/* ── Main Dashboard ── */
export default function Dashboard() {
  const [tab, setTab]           = useState<"signals" | "news" | "settings" | "paper" | "ai_sim">("signals");
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [sub, setSub]           = useState<Sub>({ subscribed: false, markets: [] });
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [market, setMarket]     = useState("TW");
  const [newsMarket, setNewsMarket] = useState("ALL");
  const [industry, setIndustry] = useState("");
  const [newsKeyword, setNewsKeyword] = useState("");
  const [newsIndustry, setNewsIndustry] = useState("全部");
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState<{ name: string; pic: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prices, setPrices]     = useState<PriceMap>({});
  const [cryptoData, setCryptoData] = useState<{
    coins: CryptoCoinsType[];
    fear_greed: { value: number; label_zh: string };
    global: { btc_dominance: number; market_cap_change_24h: number };
  } | null>(null);
  const newsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const priceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Paper Trading ── */
  type PaperPosition = {
    id: string; symbol: string; market: string; name: string;
    direction: "BUY" | "SELL"; entry_price: number; qty: number;
    stop_loss: number; take_profit: number; entered_at: string;
    current_price: number; pnl: number; pnl_pct: number;
  };
  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("paper_positions") || "[]"); } catch { return []; }
  });

  const addPaperPosition = (signal: Signal, price: number) => {
    const pos: PaperPosition = {
      id: `${signal.symbol}-${Date.now()}`,
      symbol: signal.symbol, market: signal.market,
      name: STOCK_NAMES[signal.symbol] || signal.symbol,
      direction: signal.signal_type as "BUY" | "SELL",
      entry_price: price || signal.price, qty: 1,
      stop_loss: signal.stop_loss, take_profit: signal.target_price,
      entered_at: new Date().toISOString(),
      current_price: price || signal.price, pnl: 0, pnl_pct: 0,
    };
    const updated = [...paperPositions, pos];
    setPaperPositions(updated);
    localStorage.setItem("paper_positions", JSON.stringify(updated));
  };

  const removePaperPosition = (id: string) => {
    const updated = paperPositions.filter(p => p.id !== id);
    setPaperPositions(updated);
    localStorage.setItem("paper_positions", JSON.stringify(updated));
  };

  /* ── Real-time price fetch ── */
  const fetchPrices = useCallback(async (sigs: Signal[]) => {
    if (sigs.length === 0) return;
    const unique = Array.from(new Map(sigs.map(s => [s.symbol, s.market])));
    const symbols = unique.map(([sym]) => sym).join(",");
    const markets = unique.map(([, mkt]) => mkt).join(",");
    const res = await fetch(`/api/prices?symbols=${symbols}&markets=${markets}`)
      .then(r => r.json()).catch(() => ({ prices: {} }));
    if (res.prices) setPrices(res.prices);
  }, []);

  /* ── Signals & Stats ── */
  const fetchData = useCallback(async () => {
    setRefreshing(true);
    const [sigRes, statRes, subRes] = await Promise.all([
      fetch(`/api/signals?market=${market}&limit=40`).then(r => r.json()).catch(() => ({ signals: [] })),
      fetch("/api/stats").then(r => r.json()).catch(() => ({})),
      fetch("/api/subscribe").then(r => r.json()).catch(() => ({ subscribed: false, markets: [] })),
    ]);
    const sigs: Signal[] = sigRes.signals || [];
    setSignals(sigs);
    setStats(statRes);
    setSub(subRes);
    setLoading(false);
    setRefreshing(false);
    // Fetch real-time prices for displayed signals
    fetchPrices(sigs);
  }, [market, fetchPrices]);

  /* ── News fetch ── */
  const fetchNews = useCallback(async (mkt = newsMarket, q = newsKeyword, ind = newsIndustry) => {
    setNewsLoading(true);
    const params = new URLSearchParams({ market: mkt });
    if (q) params.set("q", q);
    if (ind && ind !== "全部") params.set("industry", ind);
    const res = await fetch(`/api/news?${params}`).then(r => r.json()).catch(() => ({ news: [] }));
    setNews(res.news || []);
    setNewsLoading(false);
  }, [newsMarket, newsKeyword, newsIndustry]);

  /* ── Crypto data fetch ── */
  const fetchCryptoData = useCallback(async () => {
    const res = await fetch("/api/crypto").then(r => r.json()).catch(() => null);
    if (res) setCryptoData(res);
  }, []);

  useEffect(() => {
    const getCookie = (name: string) =>
      document.cookie.split(";").find(c => c.trim().startsWith(name + "="))?.split("=")[1];
    const name = getCookie("display_name");
    const pic = getCookie("picture_url");
    if (name) setUser({ name: decodeURIComponent(name), pic: pic ? decodeURIComponent(pic) : "" });
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === "news") fetchNews(newsMarket, newsKeyword, newsIndustry);
  }, [tab, newsMarket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (market === "CRYPTO") fetchCryptoData();
  }, [market, fetchCryptoData]);

  // Auto-refresh prices every 30 seconds during market hours
  useEffect(() => {
    if (signals.length === 0) return;
    const refresh = () => fetchPrices(signals);
    priceTimerRef.current = setInterval(refresh, 30000);
    return () => { if (priceTimerRef.current) clearInterval(priceTimerRef.current); };
  }, [signals, fetchPrices]);

  // Debounce news keyword search
  useEffect(() => {
    if (tab !== "news") return;
    if (newsTimerRef.current) clearTimeout(newsTimerRef.current);
    newsTimerRef.current = setTimeout(() => fetchNews(newsMarket, newsKeyword), 600);
    return () => { if (newsTimerRef.current) clearTimeout(newsTimerRef.current); };
  }, [newsKeyword]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Subscription ── */
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

  /* ── Industry filter (client-side for TW) ── */
  const filteredSignals = (() => {
    if (market !== "TW" || !industry) return signals;
    const ind = TW_INDUSTRIES.find(i => i.key === industry);
    if (!ind) return signals;
    return signals.filter(s => ind.syms.some(sym => s.symbol.startsWith(sym)));
  })();

  /* ── Navbar ── */
  const Navbar = () => (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(5,16,10,0.94)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      padding: "0 1.25rem", height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
        <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>🐸</span>
        <div className="sm-hide">
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--t1)" }}>呱呱投資俱樂部</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulseDot 2s infinite" }}></span>
            <span style={{ color: "var(--green)" }}>AI 即時監控中</span>
          </div>
        </div>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {user.pic && (
              <img src={user.pic} alt="" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--green)" }} />
            )}
            <span className="sm-hide" style={{ color: "var(--t1)", fontSize: "0.88rem", fontWeight: 600 }}>{user.name}</span>
          </div>
        ) : (
          <Link href="/" style={{ color: "var(--t3)", fontSize: "0.88rem", textDecoration: "none" }}>登入</Link>
        )}
        <button
          onClick={() => { fetchData(); if (tab === "news") fetchNews(); }}
          disabled={refreshing}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--t2)",
            borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.83rem",
            minHeight: 36, display: "flex", alignItems: "center", gap: "0.3rem",
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>🔄</span>
          <span className="sm-hide">更新</span>
        </button>
      </div>
    </nav>
  );

  /* ── Tab bar ── */
  const TabBar = () => (
    <div style={{
      display: "flex", borderBottom: "1px solid var(--border)",
      background: "var(--bg-nav)", overflowX: "auto", padding: "0 1rem",
      WebkitOverflowScrolling: "touch",
    }}>
      {[
        { key: "signals", label: "📊 訊號" },
        { key: "news",    label: "📰 新聞" },
        { key: "ai_sim",  label: "🤖 AI分析" },
        { key: "paper",   label: "🎮 模擬倉" },
        { key: "settings",label: "⚙️ 設定" },
      ].map(t => (
        <button
          key={t.key}
          className={`tab ${tab === t.key ? "active" : ""}`}
          onClick={() => setTab(t.key as typeof tab)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  /* ── Market Overview (4-quadrant) ── */
  const MarketOverview = () => {
    const [indexPrices, setIndexPrices] = useState<PriceMap>({});
    const [activeChart, setActiveChart] = useState<string | null>(null);

    useEffect(() => {
      // Fetch index prices
      const syms = MARKET_INDICES.map(i => i.symbol).join(",");
      const mkts = MARKET_INDICES.map(i => i.market).join(",");
      fetch(`/api/prices?symbols=${syms}&markets=${mkts}`)
        .then(r => r.json())
        .then(d => { if (d.prices) setIndexPrices(d.prices); })
        .catch(() => {});
    }, []);

    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--t2)" }}>📡 即時大盤指數</span>
          <span style={{ fontSize: "0.68rem", color: "var(--t3)" }}>每30秒自動更新</span>
        </div>
        {/* Market index grid: TW full-width on top, others below */}
        <div suppressHydrationWarning style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
          {MARKET_INDICES.map(idx => {
            const p = indexPrices[idx.symbol];
            const isUp = p && p.changePercent >= 0;
            const isActive = activeChart === idx.symbol;
            const isTW = idx.market === "TW";

            return (
              <div key={idx.symbol} className={isTW ? "market-idx-tw" : ""}>
                <div
                  onClick={() => setActiveChart(isActive ? null : idx.symbol)}
                  style={{
                    background: "var(--bg-card)",
                    borderTop: `1px solid ${isActive ? idx.color : "var(--border)"}`,
                    borderRight: `1px solid ${isActive ? idx.color : "var(--border)"}`,
                    borderBottom: `1px solid ${isActive ? idx.color : "var(--border)"}`,
                    borderLeft: `3px solid ${idx.color}`,
                    borderRadius: 12, padding: "0.75rem 1rem", cursor: "pointer",
                    transition: "all .2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: idx.color, fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {idx.emoji} {idx.name}
                        {isTW && <span style={{ background: "rgba(56,189,248,.2)", color: "var(--tw)", fontSize: "0.6rem", fontWeight: 800, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.05em" }}>主力</span>}
                      </div>
                      <div style={{ fontSize: isTW ? "clamp(1.2rem,3vw,1.6rem)" : "clamp(1rem,2.5vw,1.2rem)", fontWeight: 800, color: "var(--t1)", marginTop: "0.2rem" }}>
                        {p && p.price > 0
                          ? idx.market === "TW"
                            ? p.price.toLocaleString("zh-TW", { maximumFractionDigits: 0 })
                            : p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "—"
                        }
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {p && p.price > 0 && (
                        <>
                          <div style={{
                            fontSize: "0.85rem", fontWeight: 700,
                            color: isUp ? "var(--buy)" : "var(--sell)",
                          }}>
                            {isUp ? "▲" : "▼"} {Math.abs(p.changePercent).toFixed(2)}%
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--t3)" }}>
                            {isUp ? "+" : ""}{p.change.toFixed(2)}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: "0.65rem", color: "var(--t3)", marginTop: "0.2rem" }}>
                        {isActive ? "▲ 收起" : "📈 K線"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline TradingView mini chart */}
                {isActive && (
                  <div style={{
                    marginTop: "0.4rem",
                    background: "var(--bg-card)",
                    border: `1px solid ${idx.color}44`,
                    borderRadius: 12, overflow: "hidden",
                    animation: "fadeUp .2s ease",
                  }}>
                    <LightweightChart symbol={idx.symbol} market={idx.market} height={120} mini={true} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Stats grid ── */
  const StatsGrid = () => (
    <div className="stats-grid" style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
      gap: "0.75rem", marginBottom: "1.5rem",
    }}>
      <StatCard label="本週訊號" value={stats?.signals_7d ?? "-"} sub="過去 7 天" />
      <StatCard label="買進訊號" value={stats?.buy_signals ?? "-"} color="var(--buy)" />
      <StatCard label="賣出訊號" value={stats?.sell_signals ?? "-"} color="var(--sell)" />
      <StatCard label="歷史勝率" value={stats ? `${stats.win_rate}%` : "-"}
        color={stats && stats.win_rate >= 50 ? "var(--buy)" : "var(--sell)"} />
      <StatCard label="累計損益" value={stats ? `${stats.total_pnl >= 0 ? "+" : ""}${stats.total_pnl}%` : "-"}
        color={stats && stats.total_pnl >= 0 ? "var(--buy)" : "var(--sell)"} />
      <StatCard label="訂閱用戶" value={stats?.subscribers ?? "-"} sub="LINE 推播人數" />
    </div>
  );

  /* ── Signals Tab ── */
  const SignalsTab = () => {
    const router = useRouter();
    const [twSearch, setTwSearch] = useState("");
    const [twSearchResults, setTwSearchResults] = useState<{ sym: string; name: string }[]>([]);

    const handleTwSearch = (q: string) => {
      setTwSearch(q);
      if (!q.trim()) { setTwSearchResults([]); return; }
      const ql = q.toLowerCase();
      const res = Object.entries(STOCK_NAMES)
        .filter(([sym, name]) => sym.toLowerCase().includes(ql) || name.toLowerCase().includes(ql))
        .slice(0, 6)
        .map(([sym, name]) => ({ sym, name }));
      setTwSearchResults(res);
    };

    return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
      {/* TW Search + Market Filter */}
      <div>
        {/* 🔍 台股搜尋 - 主要功能 */}
        <div style={{ position: "relative", marginBottom: "0.85rem" }}>
          <input
            value={twSearch}
            onChange={e => handleTwSearch(e.target.value)}
            onBlur={() => setTimeout(() => setTwSearchResults([]), 180)}
            placeholder="🔍 搜尋台股個股（名稱或代號），例：台積電、2330"
            style={{
              width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)",
              color: "var(--t1)", borderRadius: 10, padding: "0.6rem 1rem",
              fontSize: "16px", outline: "none", minHeight: 46,
              WebkitAppearance: "none",
            }}
          />
          {twSearchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, zIndex: 100, overflow: "hidden", boxShadow: "0 8px 24px #000a",
            }}>
              {twSearchResults.map(r => (
                <button key={r.sym}
                  onMouseDown={() => { router.push(`/stock/${r.sym}`); setTwSearch(""); setTwSearchResults([]); }}
                  style={{
                    width: "100%", background: "none", border: "none",
                    borderBottom: "1px solid var(--border)",
                    padding: "0.65rem 1rem", cursor: "pointer", textAlign: "left",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                  <span style={{ color: "var(--t1)", fontWeight: 700 }}>{r.name}</span>
                  <span style={{ color: "var(--tw)", fontSize: "0.82rem" }}>{r.sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="market-filter-strip" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
          {MARKETS.map(m => {
            const isTWBtn = m === "TW";
            const isActive = market === m;
            return (
              <button key={m} onClick={() => { setMarket(m); setIndustry(""); }}
                style={{
                  background: isActive
                    ? isTWBtn ? "rgba(56,189,248,.2)" : "rgba(34,197,94,.18)"
                    : isTWBtn ? "rgba(56,189,248,.06)" : "var(--bg-card)",
                  color: isActive
                    ? isTWBtn ? "var(--tw)" : "var(--green-light)"
                    : isTWBtn ? "var(--tw)" : "var(--t3)",
                  border: `${isTWBtn ? "2px" : "1px"} solid ${isActive
                    ? isTWBtn ? "var(--tw)" : "var(--green)"
                    : isTWBtn ? "rgba(56,189,248,.35)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: isTWBtn ? "0.4rem 1rem" : "0.4rem 0.9rem",
                  cursor: "pointer",
                  fontWeight: isActive || isTWBtn ? 700 : 400,
                  fontSize: isTWBtn ? "0.9rem" : "0.85rem",
                  minHeight: 40, transition: "all .2s",
                }}>
                {m === "ALL" ? "🌍 全部" : MARKET_LABEL[m]}
                {isTWBtn && <span style={{ marginLeft: "0.3rem", fontSize: "0.6rem", opacity: 0.8 }}>主</span>}
              </button>
            );
          })}
        </div>

        {/* TW Sector quick-filter */}
        {market === "TW" && (
          <div className="sector-filter" style={{ display: "flex", gap: "0.4rem", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "0.4rem", marginBottom: "0.4rem" }}>
            {TW_SECTOR_FILTER.map(sector => {
              const mappedKey = TW_SECTOR_KEY[sector] || "";
              const isActive = sector === "全部" ? !industry : industry === mappedKey;
              return (
                <button key={sector}
                  onClick={() => setIndustry(sector === "全部" ? "" : (industry === mappedKey ? "" : mappedKey))}
                  className="sector-btn"
                  style={{
                    background: isActive ? "rgba(56,189,248,.18)" : "var(--bg-card)",
                    color: isActive ? "var(--tw)" : "var(--t3)",
                    border: `1px solid ${isActive ? "var(--tw)" : "var(--border)"}`,
                    borderRadius: 20, padding: "0.28rem 0.75rem", cursor: "pointer",
                    fontSize: "0.75rem", fontWeight: isActive ? 700 : 400,
                    whiteSpace: "nowrap", minHeight: 34, transition: "all .15s",
                    flexShrink: 0,
                    WebkitTapHighlightColor: "transparent",
                  }}>{sector}</button>
              );
            })}
          </div>
        )}

        {/* TW Industry filter */}
        {market === "TW" && (
          <div className="sector-filter" style={{ display: "flex", gap: "0.4rem", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "0.5rem" }}>
            <button onClick={() => setIndustry("")}
              style={{
                background: !industry ? "rgba(56,189,248,.15)" : "var(--bg-card)",
                color: !industry ? "var(--tw)" : "var(--t3)",
                border: `1px solid ${!industry ? "var(--tw)" : "var(--border)"}`,
                borderRadius: 6, padding: "0.3rem 0.75rem", cursor: "pointer",
                fontSize: "0.78rem", minHeight: 34, flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
              }}>全產業</button>
            {TW_INDUSTRIES.map(ind => (
              <button key={ind.key} onClick={() => setIndustry(industry === ind.key ? "" : ind.key)}
                style={{
                  background: industry === ind.key ? "rgba(56,189,248,.15)" : "var(--bg-card)",
                  color: industry === ind.key ? "var(--tw)" : "var(--t3)",
                  border: `1px solid ${industry === ind.key ? "var(--tw)" : "var(--border)"}`,
                  borderRadius: 6, padding: "0.3rem 0.75rem", cursor: "pointer",
                  fontSize: "0.78rem", minHeight: 34, transition: "all .15s",
                  flexShrink: 0, whiteSpace: "nowrap",
                  WebkitTapHighlightColor: "transparent",
                }}>{ind.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Reference notice for non-TW markets */}
      {(market === "US" || market === "FUTURES" || market === "CRYPTO") && (
        <div style={{
          background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)",
          borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontSize: "0.85rem" }}>ℹ️</span>
          <span style={{ fontSize: "0.78rem", color: "var(--gold)" }}>
            此為<strong>參考資訊</strong>，本系統以<strong>🇹🇼 台股</strong>為主力分析市場。
            美股 / 期貨 / 加密貨幣數據作為輔助判斷依據。
          </span>
        </div>
      )}

      {/* Crypto market panel */}
      {market === "CRYPTO" && cryptoData && (
        <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Fear & Greed + BTC Dominance row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {/* Fear & Greed */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
              <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>恐懼貪婪指數</div>
              <div style={{
                fontSize: "2rem", fontWeight: 800,
                color: cryptoData.fear_greed.value <= 25 ? "#f43f5e"
                  : cryptoData.fear_greed.value <= 40 ? "#fb923c"
                  : cryptoData.fear_greed.value <= 60 ? "var(--t2)"
                  : cryptoData.fear_greed.value <= 75 ? "#4ade80"
                  : "#22c55e",
              }}>{cryptoData.fear_greed.value}</div>
              <div style={{ color: "var(--t3)", fontSize: "0.78rem", marginTop: "0.2rem" }}>{cryptoData.fear_greed.label_zh}</div>
            </div>
            {/* BTC Dominance */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem" }}>
              <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>BTC 市佔率</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--crypto)" }}>
                {cryptoData.global.btc_dominance.toFixed(1)}%
              </div>
              <div style={{ marginTop: "0.4rem", background: "var(--bg)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, cryptoData.global.btc_dominance)}%`, height: "100%", background: "var(--crypto)", borderRadius: 4 }} />
              </div>
              <div style={{ color: cryptoData.global.market_cap_change_24h >= 0 ? "var(--buy)" : "var(--sell)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                總市值 {cryptoData.global.market_cap_change_24h >= 0 ? "▲" : "▼"}{Math.abs(cryptoData.global.market_cap_change_24h).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Top 10 coins table */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", fontWeight: 700, color: "var(--t2)" }}>
              🪙 前 10 大加密貨幣
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ color: "var(--t3)" }}>
                    <th style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 500 }}>幣種</th>
                    <th style={{ padding: "0.5rem 0.5rem", textAlign: "right", fontWeight: 500 }}>價格 (USD)</th>
                    <th style={{ padding: "0.5rem 0.5rem", textAlign: "right", fontWeight: 500 }}>24h%</th>
                    <th style={{ padding: "0.5rem 1rem", textAlign: "right", fontWeight: 500 }}>市值</th>
                  </tr>
                </thead>
                <tbody>
                  {cryptoData.coins.slice(0, 10).map((coin, idx) => (
                    <tr key={coin.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {coin.image && <img src={coin.image} alt={coin.symbol} style={{ width: 20, height: 20, borderRadius: "50%" }} />}
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--t1)" }}>{coin.symbol}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--t3)" }}>#{idx + 1}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem 0.5rem", textAlign: "right", color: "var(--t1)", fontWeight: 600 }}>
                        ${coin.price >= 1000
                          ? coin.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
                          : coin.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td style={{ padding: "0.5rem 0.5rem", textAlign: "right", fontWeight: 600, color: coin.change_24h >= 0 ? "var(--buy)" : "var(--sell)" }}>
                        {coin.change_24h >= 0 ? "▲" : "▼"}{Math.abs(coin.change_24h).toFixed(2)}%
                      </td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "var(--t3)" }}>
                        ${(coin.market_cap / 1e9).toFixed(1)}B
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "1.25rem", alignItems: "start" }}>
        {/* Signals list */}
        <div>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--t2)" }}>
                {market === "TW" ? "🇹🇼 台股 AI 訊號" :
                 market === "US" ? "🇺🇸 美股參考訊號" :
                 market === "FUTURES" ? "📊 期貨參考訊號" :
                 market === "CRYPTO" ? "🪙 加密參考訊號" : "🌍 全市場訊號"}
              </span>
              {(market === "US" || market === "FUTURES" || market === "CRYPTO") && (
                <span style={{ fontSize: "0.62rem", color: "var(--gold)", background: "rgba(251,191,36,.1)", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>輔助</span>
              )}
              {market === "TW" && (
                <span style={{ fontSize: "0.62rem", color: "var(--tw)", background: "rgba(56,189,248,.12)", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>主力</span>
              )}
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--t3)" }}>最近 {signals.length} 筆</span>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />
              ))}
            </div>
          ) : filteredSignals.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "3rem 1.5rem",
              background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🤖</div>
              <div style={{ color: "var(--t2)", fontWeight: 600, marginBottom: "0.5rem" }}>AI 正在分析市場，訊號即將產生</div>
              <div style={{ fontSize: "0.83rem", color: "var(--t3)" }}>
                執行 <code style={{ color: "var(--green)", background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}>python main.py once</code> 立即產生訊號
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              <div style={{ color: "var(--t3)", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
                共 {filteredSignals.length} 筆訊號{industry ? ` · ${TW_INDUSTRIES.find(i => i.key === industry)?.label}` : ""}
              </div>
              {filteredSignals.map(s => <SignalCard key={s.id} signal={s} realtimePrice={prices[s.symbol]} onPaperTrade={addPaperPosition} />)}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="md-hide" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <SidebarContent stats={stats} sub={sub} user={user} toggleSubscribe={toggleSubscribe} toggleMarket={toggleMarket} />
        </div>
      </div>

      {/* Mobile sidebar (always show below signals) */}
      <div style={{ display: "none" }} className="show-mobile-block">
        <SidebarContent stats={stats} sub={sub} user={user} toggleSubscribe={toggleSubscribe} toggleMarket={toggleMarket} />
      </div>
    </div>
  );
  };

  /* ── News Tab ── */
  const NewsTab = () => (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {["ALL", "TW", "US", "FUTURES", "CRYPTO"].map(m => (
          <button key={m} onClick={() => setNewsMarket(m)}
            style={{
              background: newsMarket === m ? "rgba(34,197,94,.15)" : "var(--bg-card)",
              color: newsMarket === m ? "var(--green-light)" : "var(--t3)",
              border: `1px solid ${newsMarket === m ? "var(--green)" : "var(--border)"}`,
              borderRadius: 8, padding: "0.4rem 0.85rem", cursor: "pointer",
              fontWeight: newsMarket === m ? 700 : 400, fontSize: "0.82rem", minHeight: 40,
            }}>
            {m === "ALL" ? "🌍 全部" : MARKET_LABEL[m] || m}
          </button>
        ))}
      </div>

      {/* Industry tabs */}
      <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
        {INDUSTRY_TABS.map(tab => (
          <button key={tab} onClick={() => { setNewsIndustry(tab); fetchNews(newsMarket, newsKeyword, tab); }}
            style={{
              background: newsIndustry === tab ? "rgba(34,197,94,.18)" : "var(--bg-card)",
              color: newsIndustry === tab ? "var(--green-light)" : "var(--t3)",
              border: `1px solid ${newsIndustry === tab ? "var(--green)" : "var(--border)"}`,
              borderRadius: 20, padding: "0.3rem 0.85rem", cursor: "pointer",
              fontWeight: newsIndustry === tab ? 700 : 400, fontSize: "0.78rem",
              whiteSpace: "nowrap", minHeight: 32, transition: "all .15s",
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1rem" }}>
        <input
          className="input"
          placeholder="🔍 搜尋新聞關鍵字（例：台積電、NVDA、比特幣）"
          value={newsKeyword}
          onChange={e => setNewsKeyword(e.target.value)}
          style={{ paddingLeft: "1rem" }}
        />
      </div>

      {/* News list */}
      {newsLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      ) : news.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📰</div>
          <div style={{ color: "var(--t3)" }}>暫無新聞，請稍後再試</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <div style={{ color: "var(--t3)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
            共 {news.length} 則新聞
          </div>
          {news.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );

  /* ── Settings Tab ── */
  const SettingsTab = () => (
    <div style={{ maxWidth: 600 }}>
      {/* Subscription Toggle */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "1.1rem", fontSize: "1rem" }}>
          🔔 LINE 推播設定
        </div>
        {user ? (
          <>
            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", padding: "0.75rem", background: "var(--bg)", borderRadius: 10 }}>
              {user.pic && <img src={user.pic} alt="" style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid var(--green)" }} />}
              <div>
                <div style={{ fontWeight: 600, color: "var(--t1)" }}>{user.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--green)" }}>LINE 已綁定</div>
              </div>
            </div>

            {/* Subscribe toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ color: "var(--t1)", fontWeight: 600 }}>接收推播通知</div>
                <div style={{ fontSize: "0.78rem", color: "var(--t3)" }}>AI 訊號產生時立即通知</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={sub.subscribed} onChange={toggleSubscribe} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Market toggles */}
            <div style={{ color: "var(--t2)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>
              選擇接收的市場通知
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                { key: "TW",      label: "🇹🇼 台股", desc: "台積電、聯發科等台灣股市" },
                { key: "US",      label: "🇺🇸 美股", desc: "NVDA、TSLA、AAPL 等" },
                { key: "FUTURES", label: "📊 期貨",  desc: "台指期、S&P 500 期貨" },
                { key: "CRYPTO",  label: "🪙 加密",  desc: "BTC、ETH、SOL 等" },
              ].map(m => (
                <div key={m.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.8rem 1rem", background: "var(--bg)", borderRadius: 10,
                  border: `1px solid ${sub.markets.includes(m.key) ? "var(--green)" : "var(--border)"}`,
                  transition: "border-color .2s",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--t1)", fontSize: "0.9rem" }}>{m.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--t3)" }}>{m.desc}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={sub.markets.includes(m.key)} onChange={() => toggleMarket(m.key)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔐</div>
            <div style={{ color: "var(--t3)", marginBottom: "1rem" }}>登入後才能設定推播通知</div>
            <Link href="/" className="btn btn-line" style={{ display: "inline-flex" }}>
              LINE 登入
            </Link>
          </div>
        )}
      </div>

      {/* Taiwan Industry Preferences */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.5rem" }}>🇹🇼 台股產業分類</div>
        <div style={{ color: "var(--t3)", fontSize: "0.82rem", marginBottom: "1rem" }}>
          在訊號頁面可按產業篩選，快速找到感興趣的標的
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: "0.5rem" }}>
          {TW_INDUSTRIES.map(ind => (
            <div key={ind.key} style={{
              padding: "0.6rem 0.8rem", background: "var(--bg)",
              borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.83rem",
            }}>
              <div style={{ fontWeight: 600, color: "var(--t2)" }}>{ind.label}</div>
              <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                {ind.syms.slice(0, 3).join("、")} 等
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Review */}
      {stats?.latest_review && (
        <div className="card">
          <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.9rem" }}>🧠 最新 AI 市場復盤</div>
          <div style={{ fontSize: "0.85rem", color: "var(--t2)", lineHeight: 1.75 }}>
            {String(stats.latest_review.market_assessment || "").substring(0, 200)}
          </div>
          {Boolean(stats.latest_review.risk_warning) && (
            <div style={{
              marginTop: "0.9rem", background: "rgba(244,63,94,0.1)",
              border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8,
              padding: "0.6rem 0.8rem", fontSize: "0.82rem", color: "var(--sell)",
            }}>
              ⚠️ {String(stats.latest_review.risk_warning)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ── AI Simulation Process Tab ── */
  function AiSimTab({ signals, loading }: { signals: Signal[]; loading: boolean }) {
    const [selectedSym, setSelectedSym] = useState<string | null>(null);

    const recentSignals = signals.filter(s => s.signal_type === "BUY" || s.signal_type === "SELL").slice(0, 20);
    const selected = selectedSym ? recentSignals.find(s => s.symbol === selectedSym) : recentSignals[0];

    const techScore  = (s: Signal) => Math.round((s.technical_score || 0) * 100);
    const sentScore  = (s: Signal) => Math.round(Math.abs(s.sentiment_score || 0) * 100);
    const confScore  = (s: Signal) => Math.round((s.confidence || 0) * 100) || Math.round(s.confidence || 0);

    const STEPS = (s: Signal) => [
      {
        step: 1, label: "📥 資料抓取", status: "done",
        detail: `抓取 ${s.symbol} 近 6 個月 K 線數據（不採用 1 年以上舊資料）`,
        color: "var(--green)",
      },
      {
        step: 2, label: "📊 技術面分析", status: "done",
        detail: `技術評分 ${techScore(s)}% | MACD / RSI / 布林帶 / ADX / 均線趨勢 | ${s.technical_summary || "多指標共振判斷"}`,
        color: techScore(s) > 50 ? "var(--buy)" : "var(--sell)",
        score: techScore(s),
      },
      {
        step: 3, label: "🏦 籌碼面分析", status: "done",
        detail: s.market === "TW"
          ? `外資/投信/自營商買賣超、融資融券、法人持股集中度分析`
          : s.market === "CRYPTO"
          ? `鏈上數據、巨鯨地址動向、交易所淨流入/出分析`
          : `機構買賣動向、期貨未平倉量、選擇權Put/Call比`,
        color: "var(--tw)",
        score: confScore(s),
      },
      {
        step: 4, label: "📰 消息面情緒", status: "done",
        detail: `新聞情緒評分 ${sentScore(s)}% | ${s.news_sentiment ? (s.news_sentiment === "POSITIVE" ? "正面消息主導" : s.news_sentiment === "NEGATIVE" ? "負面消息主導" : "消息中性") : "AI 掃描近期新聞"}`,
        color: (s.sentiment_score || 0) > 0 ? "var(--buy)" : (s.sentiment_score || 0) < 0 ? "var(--sell)" : "var(--hold)",
        score: sentScore(s),
      },
      {
        step: 5, label: "🧠 Claude AI 深度分析", status: "done",
        detail: s.reasoning || s.ai_analysis || "Claude Sonnet 融合技術面、籌碼面、消息面，進行深度判斷",
        color: "var(--crypto)",
      },
      {
        step: 6, label: "⚖️ 多維度投票融合", status: "done",
        detail: `技術 25% + ML 25% + 情緒 20% + 籌碼 30% → 加權總分 ${confScore(s)}%`,
        color: "var(--gold)",
        score: confScore(s),
      },
      {
        step: 7, label: s.signal_type === "BUY" ? "🟢 最終判斷：買進" : "🔴 最終判斷：賣出",
        status: "done",
        detail: `進場 ${s.price?.toFixed(2)} | 止盈 ${s.target_price?.toFixed(2)} | 止損 ${s.stop_loss?.toFixed(2)} | 信心度 ${confScore(s)}%`,
        color: s.signal_type === "BUY" ? "var(--buy)" : "var(--sell)",
      },
    ];

    if (loading) return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--t3)" }}>
        <div style={{ fontSize: "2rem", animation: "spin 1s linear infinite", display: "inline-block" }}>🤖</div>
        <div style={{ marginTop: "0.75rem" }}>AI 分析載入中...</div>
      </div>
    );

    return (
      <div style={{ display: "grid", gridTemplateColumns: "clamp(160px,30%,220px) 1fr", gap: "1rem" }} className="ai-sim-grid">
        {/* Left: signal list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--t3)", marginBottom: "0.25rem", fontWeight: 600 }}>
            近期 AI 分析標的
          </div>
          {recentSignals.length === 0 && (
            <div style={{ color: "var(--t3)", fontSize: "0.82rem" }}>尚無訊號</div>
          )}
          {recentSignals.map(s => {
            const isSel = (selectedSym ?? recentSignals[0]?.symbol) === s.symbol;
            return (
              <button key={`${s.id}-${s.symbol}`}
                onClick={() => setSelectedSym(s.symbol)}
                style={{
                  background: isSel ? "var(--bg-card2)" : "var(--bg-card)",
                  border: `1px solid ${isSel ? "var(--green)" : "var(--border)"}`,
                  borderRadius: 10, padding: "0.6rem 0.75rem", cursor: "pointer",
                  textAlign: "left", transition: "all .15s",
                }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--t1)" }}>{s.symbol}</div>
                <div style={{ fontSize: "0.7rem", color: s.signal_type === "BUY" ? "var(--buy)" : "var(--sell)" }}>
                  {s.signal_type === "BUY" ? "🟢 買進" : "🔴 賣出"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--t3)", marginTop: "0.15rem" }}>
                  {new Date(s.created_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: step-by-step process */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {selected ? (
            <>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "0.25rem" }}>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--t1)", marginBottom: "0.3rem" }}>
                  🤖 AI 分析過程 — {STOCK_NAMES[selected.symbol] || selected.symbol} ({selected.symbol})
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--t3)" }}>
                  以下是 Claude AI 對此標的完整的逐步分析推理過程
                </div>
              </div>
              {STEPS(selected).map((step) => (
                <div key={step.step} className="fade-up" style={{
                  background: "var(--bg-card)",
                  borderTop: `1px solid ${step.color}33`,
                  borderRight: `1px solid ${step.color}33`,
                  borderBottom: `1px solid ${step.color}33`,
                  borderLeft: `3px solid ${step.color}`,
                  borderRadius: 10, padding: "0.8rem 1rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: step.color }}>{step.label}</div>
                    {step.score !== undefined && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 60, height: 5, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${step.score}%`, height: "100%", background: step.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: "0.72rem", color: step.color, fontWeight: 700 }}>{step.score}%</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--t2)", lineHeight: 1.6 }}>{step.detail}</div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--t3)" }}>
              ← 點選左側標的查看 AI 分析過程
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <TabBar />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.25rem 1rem" }}>
        {tab === "signals" && <MarketOverview />}
        <StatsGrid />
        {tab === "signals"  && <SignalsTab />}
        {tab === "news"     && <NewsTab />}
        {tab === "ai_sim"   && <AiSimTab signals={signals} loading={loading} />}
        {tab === "settings" && <SettingsTab />}
        {tab === "paper" && (
          <div style={{ padding: "0 0 2rem" }}>
            <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: "0.95rem", marginBottom: "1rem" }}>
              🎮 模擬倉 · {paperPositions.length} 筆持倉
            </div>
            {paperPositions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--t3)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎮</div>
                <div>點擊訊號卡片上的「模擬」按鈕加入模擬倉</div>
                <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", color: "var(--t4)" }}>資金不風險，練習 AI 訊號操作</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  {[
                    { label: "持倉數", value: paperPositions.length },
                    { label: "模擬盈利", value: `${paperPositions.filter(p=>{ const cur = prices[p.symbol]?.price || p.entry_price; const pct = p.direction === "BUY" ? (cur - p.entry_price) / p.entry_price * 100 : (p.entry_price - cur) / p.entry_price * 100; return pct > 0; }).length} 筆` },
                    { label: "模擬虧損", value: `${paperPositions.filter(p=>{ const cur = prices[p.symbol]?.price || p.entry_price; const pct = p.direction === "BUY" ? (cur - p.entry_price) / p.entry_price * 100 : (p.entry_price - cur) / p.entry_price * 100; return pct < 0; }).length} 筆` },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", textAlign: "center" }}>
                      <div style={{ color: "var(--t3)", fontSize: "0.7rem" }}>{s.label}</div>
                      <div style={{ color: "var(--t1)", fontWeight: 700 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Positions */}
                {paperPositions.map(pos => {
                  const curPrice = prices[pos.symbol]?.price || pos.entry_price;
                  const pnlPct = pos.direction === "BUY"
                    ? (curPrice - pos.entry_price) / pos.entry_price * 100
                    : (pos.entry_price - curPrice) / pos.entry_price * 100;
                  return (
                    <div key={pos.id} style={{ background: "var(--bg-card)", border: `1px solid ${pnlPct >= 0 ? "var(--buy)" : "var(--sell)"}44`, borderRadius: 12, padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "var(--t1)", marginRight: "0.5rem" }}>{pos.symbol}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--t3)" }}>{pos.name}</span>
                          <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: pos.direction === "BUY" ? "var(--buy)" : "var(--sell)", background: pos.direction === "BUY" ? "var(--buy)22" : "var(--sell)22", padding: "1px 6px", borderRadius: 4 }}>{pos.direction === "BUY" ? "📈 做多" : "📉 做空"}</span>
                        </div>
                        <button onClick={() => removePaperPosition(pos.id)} style={{ fontSize: "0.7rem", color: "var(--t4)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕ 平倉</button>
                      </div>
                      <div className="paper-pos-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.4rem" }}>
                        {[
                          { label: "進場", val: pos.entry_price.toLocaleString() },
                          { label: "現價", val: curPrice.toLocaleString() },
                          { label: "損益", val: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`, color: pnlPct >= 0 ? "var(--buy)" : "var(--sell)" },
                          { label: "進場時間", val: new Date(pos.entered_at).toLocaleString("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }) },
                        ].map(f => (
                          <div key={f.label} style={{ textAlign: "center", background: "var(--bg)", borderRadius: 6, padding: "0.3rem" }}>
                            <div style={{ fontSize: "0.62rem", color: "var(--t3)" }}>{f.label}</div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: (f as {label:string;val:string;color?:string}).color || "var(--t1)" }}>{f.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function SidebarContent({
  stats, sub, user, toggleSubscribe, toggleMarket,
}: {
  stats: Stats | null; sub: Sub; user: { name: string; pic: string } | null;
  toggleSubscribe: () => void; toggleMarket: (m: string) => void;
}) {
  return (
    <>
      {/* Subscription card */}
      <div className="card">
        <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.9rem", fontSize: "0.9rem" }}>🔔 LINE 推播設定</div>
        {user ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
              <span style={{ color: "var(--t2)", fontSize: "0.85rem" }}>接收推播</span>
              <label className="toggle">
                <input type="checkbox" checked={sub.subscribed} onChange={toggleSubscribe} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div style={{ color: "var(--t3)", fontSize: "0.78rem", marginBottom: "0.6rem" }}>接收市場：</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["TW", "US", "FUTURES", "CRYPTO"].map(m => (
                <button key={m} onClick={() => toggleMarket(m)}
                  style={{
                    background: sub.markets.includes(m) ? `${MARKET_COLOR[m]}18` : "var(--bg)",
                    color: sub.markets.includes(m) ? MARKET_COLOR[m] : "var(--t3)",
                    border: `1px solid ${sub.markets.includes(m) ? MARKET_COLOR[m] : "var(--border)"}`,
                    borderRadius: 6, padding: "0.28rem 0.65rem", cursor: "pointer",
                    fontSize: "0.75rem", minHeight: 32, transition: "all .15s",
                  }}>
                  {MARKET_LABEL[m]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <Link href="/" className="btn btn-line" style={{ display: "flex", width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
            LINE 登入後訂閱
          </Link>
        )}
      </div>

      {/* Market distribution */}
      <div className="card">
        <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.9rem", fontSize: "0.9rem" }}>📊 本週訊號分布</div>
        {stats?.by_market && Object.entries(stats.by_market).length > 0
          ? Object.entries(stats.by_market).map(([m, cnt]) => (
            <div key={m} style={{ marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "var(--t3)" }}>{MARKET_LABEL[m] || m}</span>
                <span style={{ color: "var(--t1)", fontWeight: 700 }}>{cnt as number}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${Math.min(100, (cnt as number) / Math.max(stats.signals_7d, 1) * 100)}%`,
                  background: MARKET_COLOR[m] || "var(--green)",
                }}></div>
              </div>
            </div>
          ))
          : <div style={{ color: "var(--t3)", fontSize: "0.83rem" }}>尚無訊號資料</div>
        }
      </div>

      {/* AI review */}
      {stats?.latest_review && (
        <div className="card">
          <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.7rem", fontSize: "0.9rem" }}>🧠 AI 復盤摘要</div>
          <div style={{ fontSize: "0.8rem", color: "var(--t2)", lineHeight: 1.7 }}>
            {String(stats.latest_review.market_assessment || "").substring(0, 120)}...
          </div>
          {Boolean(stats.latest_review.risk_warning) && (
            <div style={{
              marginTop: "0.6rem", background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.25)", borderRadius: 8,
              padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--sell)",
            }}>
              ⚠️ {String(stats.latest_review.risk_warning).substring(0, 80)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
