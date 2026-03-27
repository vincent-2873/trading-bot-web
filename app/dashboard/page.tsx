"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ── Types ── */
type Signal = {
  id: number; symbol: string; market: string; signal_type: string;
  confidence: number; price: number; stop_loss: number;
  target_price: number; reasoning: string; technical_score: number;
  sentiment_score: number; created_at: string;
  // legacy aliases (frontend compat)
  signal_strength?: number; entry_price?: number; take_profit?: number;
  ai_analysis?: string; technical_summary?: string; news_sentiment?: string;
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
};

/* ── Constants ── */
const MARKETS = ["ALL", "TW", "US", "FUTURES", "CRYPTO"];
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
  // 美股
  "NVDA": "NVIDIA", "TSLA": "Tesla", "AAPL": "Apple",
  "MSFT": "Microsoft", "AMZN": "Amazon", "GOOGL": "Alphabet",
  "META": "Meta", "AMD": "AMD", "INTC": "Intel",
  "NFLX": "Netflix", "UBER": "Uber",
  // 期貨
  "ES=F": "S&P500期貨", "NQ=F": "那斯達克期貨",
  "YM=F": "道瓊期貨", "RTY=F": "羅素2000",
  "GC=F": "黃金期貨", "CL=F": "原油期貨",
  // 加密
  "BTC-USD": "比特幣", "ETH-USD": "以太幣",
};

// Taiwan stock industries
const TW_INDUSTRIES = [
  { key: "semi",  label: "💻 半導體", syms: ["2330","2454","2379","3711","6770","2303","2337","3034","2344"] },
  { key: "elec",  label: "📱 電子",   syms: ["2317","2382","2308","2301","3231","2357","4938"] },
  { key: "fin",   label: "🏦 金融",   syms: ["2882","2881","2886","2891","2884","2880","2883"] },
  { key: "bio",   label: "💊 生技",   syms: ["4166","2727","1760","6446","4743","4968"] },
  { key: "trad",  label: "🏭 傳產",   syms: ["1301","1303","2002","2006","1326","1229"] },
  { key: "ship",  label: "🚢 航運",   syms: ["2603","2615","2609","2610","2618","5347"] },
  { key: "etf",   label: "📊 ETF",    syms: ["0050","0056","00878","00929","00919","006208"] },
];

/* ── TradingView Mini Chart (inline) ── */
function InlineTVChart({ tvSymbol }: { tvSymbol: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: "100%",
      height: 220,
      locale: "zh_TW",
      dateRange: "3M",
      colorTheme: "dark",
      trendLineColor: "rgba(34,197,94,1)",
      underLineColor: "rgba(34,197,94,0.1)",
      underLineBottomColor: "rgba(34,197,94,0)",
      isTransparent: true,
      autosize: true,
      largeChartUrl: `https://trading-bot-web.zeabur.app/stock/${encodeURIComponent(tvSymbol)}`,
    });
    ref.current.appendChild(script);
  }, [tvSymbol]);

  return <div ref={ref} style={{ width: "100%", height: 220 }} className="tradingview-widget-container" />;
}

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

function SignalCard({ signal, realtimePrice }: {
  signal: Signal;
  realtimePrice?: { price: number; change: number; changePercent: number; name: string };
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
        background: "var(--bg-card)", border: `1px solid ${expanded ? sc + "44" : "var(--border)"}`,
        borderRadius: 14, padding: "1.1rem", cursor: "pointer", transition: "all .2s",
        borderLeft: `3px solid ${sc}`,
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
            <span style={{ fontSize: "clamp(1rem,2.5vw,1.3rem)", fontWeight: 800, color: "var(--t1)" }}>{signal.symbol}</span>
            {stockName && (
              <span style={{ fontSize: "0.78rem", color: "var(--t3)", fontWeight: 500 }}>{stockName}</span>
            )}
          </button>
          <span className={`badge badge-${signal.signal_type.toLowerCase()}`}>{signal.signal_type}</span>
          <span style={{
            fontSize: "0.75rem", color: MARKET_COLOR[signal.market] || "var(--t3)",
            background: `${MARKET_COLOR[signal.market] || "var(--t3)"}18`,
            padding: "2px 8px", borderRadius: 6,
          }}>{MARKET_LABEL[signal.market] || signal.market}</span>
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
  const [tab, setTab]           = useState<"signals" | "news" | "settings">("signals");
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [sub, setSub]           = useState<Sub>({ subscribed: false, markets: [] });
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [market, setMarket]     = useState("ALL");
  const [newsMarket, setNewsMarket] = useState("ALL");
  const [industry, setIndustry] = useState("");
  const [newsKeyword, setNewsKeyword] = useState("");
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState<{ name: string; pic: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prices, setPrices]     = useState<PriceMap>({});
  const newsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const priceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const fetchNews = useCallback(async (mkt = newsMarket, q = newsKeyword) => {
    setNewsLoading(true);
    const params = new URLSearchParams({ market: mkt });
    if (q) params.set("q", q);
    const res = await fetch(`/api/news?${params}`).then(r => r.json()).catch(() => ({ news: [] }));
    setNews(res.news || []);
    setNewsLoading(false);
  }, [newsMarket, newsKeyword]);

  useEffect(() => {
    const getCookie = (name: string) =>
      document.cookie.split(";").find(c => c.trim().startsWith(name + "="))?.split("=")[1];
    const name = getCookie("display_name");
    const pic = getCookie("picture_url");
    if (name) setUser({ name: decodeURIComponent(name), pic: pic ? decodeURIComponent(pic) : "" });
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === "news") fetchNews(newsMarket, newsKeyword);
  }, [tab, newsMarket]); // eslint-disable-line react-hooks/exhaustive-deps

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
        { key: "news",    label: "📰 新聞時事" },
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
        {/* 4-Quadrant grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
          {MARKET_INDICES.map(idx => {
            const p = indexPrices[idx.symbol];
            const isUp = p && p.changePercent >= 0;
            const isActive = activeChart === idx.tvSymbol;

            return (
              <div key={idx.symbol}>
                <div
                  onClick={() => setActiveChart(isActive ? null : idx.tvSymbol)}
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${isActive ? idx.color : "var(--border)"}`,
                    borderRadius: 12, padding: "0.75rem 1rem", cursor: "pointer",
                    transition: "all .2s",
                    borderLeft: `3px solid ${idx.color}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: idx.color, fontWeight: 600 }}>
                        {idx.emoji} {idx.name}
                      </div>
                      <div style={{ fontSize: "clamp(1rem,2.5vw,1.2rem)", fontWeight: 800, color: "var(--t1)", marginTop: "0.2rem" }}>
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
                    <InlineTVChart tvSymbol={idx.tvSymbol} />
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
    <div style={{
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
  const SignalsTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
      {/* Market Filter */}
      <div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {MARKETS.map(m => (
            <button key={m} onClick={() => { setMarket(m); setIndustry(""); }}
              style={{
                background: market === m ? "rgba(34,197,94,.18)" : "var(--bg-card)",
                color: market === m ? "var(--green-light)" : "var(--t3)",
                border: `1px solid ${market === m ? "var(--green)" : "var(--border)"}`,
                borderRadius: 8, padding: "0.4rem 0.9rem", cursor: "pointer",
                fontWeight: market === m ? 700 : 400, fontSize: "0.85rem",
                minHeight: 40, transition: "all .2s",
              }}>
              {m === "ALL" ? "🌍 全部" : MARKET_LABEL[m]}
            </button>
          ))}
        </div>

        {/* TW Industry filter */}
        {market === "TW" && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", paddingBottom: "0.5rem" }}>
            <button onClick={() => setIndustry("")}
              style={{
                background: !industry ? "rgba(56,189,248,.15)" : "var(--bg-card)",
                color: !industry ? "var(--tw)" : "var(--t3)",
                border: `1px solid ${!industry ? "var(--tw)" : "var(--border)"}`,
                borderRadius: 6, padding: "0.3rem 0.75rem", cursor: "pointer",
                fontSize: "0.78rem", minHeight: 34,
              }}>全產業</button>
            {TW_INDUSTRIES.map(ind => (
              <button key={ind.key} onClick={() => setIndustry(industry === ind.key ? "" : ind.key)}
                style={{
                  background: industry === ind.key ? "rgba(56,189,248,.15)" : "var(--bg-card)",
                  color: industry === ind.key ? "var(--tw)" : "var(--t3)",
                  border: `1px solid ${industry === ind.key ? "var(--tw)" : "var(--border)"}`,
                  borderRadius: 6, padding: "0.3rem 0.75rem", cursor: "pointer",
                  fontSize: "0.78rem", minHeight: 34, transition: "all .15s",
                }}>{ind.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "1.25rem", alignItems: "start" }}>
        {/* Signals list */}
        <div>
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
              {filteredSignals.map(s => <SignalCard key={s.id} signal={s} realtimePrice={prices[s.symbol]} />)}
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
        {tab === "settings" && <SettingsTab />}
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
