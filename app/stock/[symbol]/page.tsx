"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── TradingView Symbol mapping ── */
function getTVSymbol(symbol: string, market: string): string {
  if (market === "TW") return `TWSE:${symbol}`;
  if (market === "FUTURES") {
    const map: Record<string, string> = {
      "ES=F": "CME_MINI:ES1!", "NQ=F": "CME_MINI:NQ1!",
      "YM=F": "CBOT_MINI:YM1!", "RTY=F": "CME_MINI:RTY1!",
      "GC=F": "COMEX:GC1!", "CL=F": "NYMEX:CL1!",
    };
    return map[symbol] || `CME:${symbol.replace("=F", "1!")}`;
  }
  if (market === "CRYPTO") {
    const map: Record<string, string> = {
      "BTC-USD": "BINANCE:BTCUSDT", "ETH-USD": "BINANCE:ETHUSDT",
    };
    return map[symbol] || `BINANCE:${symbol.replace("-USD", "USDT")}`;
  }
  // US stocks
  const nasdaqStocks = ["NVDA","AAPL","MSFT","AMZN","GOOGL","META","AMD","INTC","NFLX","UBER","TSLA"];
  if (nasdaqStocks.includes(symbol)) return `NASDAQ:${symbol}`;
  return `NYSE:${symbol}`;
}

type Signal = {
  id: number; symbol: string; market: string; signal_type: string;
  confidence: number; price: number; stop_loss: number;
  target_price: number; reasoning: string; technical_score: number;
  sentiment_score: number; created_at: string;
};

type PriceInfo = {
  price: number; change: number; changePercent: number; name: string;
};

/* ── TradingView Widget（iframe 穩定版，不中斷）── */
function TradingViewWidget({ tvSymbol }: { tvSymbol: string }) {
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0c1c10&studies=RSI%40tv-basicstudies%2CMACD%40tv-basicstudies&theme=dark&style=1&timezone=Asia%2FTaipei&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=zh_TW&utm_source=guagua.club&utm_medium=widget`;

  return (
    <iframe
      src={src}
      style={{
        width: "100%", height: 480,
        border: "none", display: "block",
        background: "var(--bg-card)",
      }}
      allowFullScreen
      loading="lazy"
      title={`TradingView Chart - ${tvSymbol}`}
    />
  );
}

export default function StockDetailPage() {
  const params = useParams();
  const symbol = decodeURIComponent(params.symbol as string);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [market, setMarket] = useState("US");
  const [loading, setLoading] = useState(true);

  const MARKET_LABEL: Record<string, string> = {
    TW: "🇹🇼 台股", US: "🇺🇸 美股", FUTURES: "📊 期貨", CRYPTO: "🪙 加密",
  };
  const MARKET_COLOR: Record<string, string> = {
    TW: "var(--tw)", US: "var(--us)", FUTURES: "var(--futures)", CRYPTO: "var(--crypto)",
  };

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch signals for this symbol
      const sigRes = await fetch(`/api/signals?symbol=${symbol}&limit=20`).then(r => r.json()).catch(() => ({ signals: [] }));
      const sigs: Signal[] = sigRes.signals || [];
      setSignals(sigs);

      // Determine market from signals or guess
      const detectedMarket = sigs[0]?.market || (
        /^\d{4}/.test(symbol) ? "TW"
          : symbol.includes("=F") ? "FUTURES"
          : symbol.includes("-USD") ? "CRYPTO" : "US"
      );
      setMarket(detectedMarket);

      // Fetch real-time price
      const priceRes = await fetch(`/api/prices?symbols=${symbol}&markets=${detectedMarket}`)
        .then(r => r.json()).catch(() => ({ prices: {} }));
      const pd = priceRes.prices?.[symbol];
      if (pd) setPriceInfo(pd);

      setLoading(false);
    }
    load();
  }, [symbol]);

  const latestSignal = signals[0];
  const tvSymbol = getTVSymbol(symbol, market);

  const formatPrice = (p: number) => {
    if (p <= 0) return "-";
    return market === "TW"
      ? p.toLocaleString("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
      : p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,16,10,0.94)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.25rem", height: 60,
        display: "flex", alignItems: "center", gap: "1rem",
      }}>
        <Link href="/dashboard" style={{
          color: "var(--t3)", textDecoration: "none", fontSize: "0.88rem",
          display: "flex", alignItems: "center", gap: "0.4rem",
        }}>
          ← 返回
        </Link>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ color: "var(--t1)", fontWeight: 700, fontSize: "1rem" }}>
          {symbol} {priceInfo?.name ? `· ${priceInfo.name}` : ""}
        </span>
        {market && (
          <span style={{
            fontSize: "0.75rem", color: MARKET_COLOR[market] || "var(--t3)",
            background: `${MARKET_COLOR[market] || "var(--t3)"}18`,
            padding: "2px 8px", borderRadius: 6,
          }}>
            {MARKET_LABEL[market] || market}
          </span>
        )}
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.25rem 1rem" }}>
        {/* Price Header */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "1.25rem", marginBottom: "1.25rem",
          display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "var(--t3)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>最新價格</div>
            <div style={{ fontSize: "clamp(1.8rem,5vw,2.8rem)", fontWeight: 800, color: "var(--t1)", lineHeight: 1 }}>
              {loading ? "—" : formatPrice(priceInfo?.price || 0)}
            </div>
          </div>
          {priceInfo && priceInfo.price > 0 && (
            <div>
              <div style={{ color: "var(--t3)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>今日漲跌</div>
              <div style={{
                fontSize: "1.4rem", fontWeight: 700,
                color: priceInfo.changePercent >= 0 ? "var(--buy)" : "var(--sell)",
              }}>
                {priceInfo.changePercent >= 0 ? "▲" : "▼"} {Math.abs(priceInfo.changePercent).toFixed(2)}%
              </div>
              <div style={{
                fontSize: "0.85rem",
                color: priceInfo.change >= 0 ? "var(--buy)" : "var(--sell)",
              }}>
                {priceInfo.change >= 0 ? "+" : ""}{formatPrice(priceInfo.change)}
              </div>
            </div>
          )}
          {/* AI Signal Summary */}
          {latestSignal && (
            <div style={{
              marginLeft: "auto", textAlign: "right",
              background: "var(--bg)", borderRadius: 10, padding: "0.75rem 1rem",
            }}>
              <div style={{ color: "var(--t3)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>AI 最新建議</div>
              <div style={{
                fontSize: "1.1rem", fontWeight: 800,
                color: latestSignal.signal_type === "BUY" ? "var(--buy)"
                  : latestSignal.signal_type === "SELL" ? "var(--sell)" : "var(--hold)",
              }}>
                {latestSignal.signal_type === "BUY" ? "📈 買進" : latestSignal.signal_type === "SELL" ? "📉 賣出" : "⚖️ 觀望"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--t3)" }}>
                信心度 {(latestSignal.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: "1.25rem", alignItems: "start" }}>
          {/* Left: Chart + Signals */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* TradingView Chart */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: "0.9rem" }}>📈 技術線圖</span>
                <span style={{ fontSize: "0.75rem", color: "var(--t3)" }}>TradingView · {tvSymbol}</span>
              </div>
              <div style={{ height: 480 }}>
                <TradingViewWidget tvSymbol={tvSymbol} />
              </div>
            </div>

            {/* Signal History */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.1rem" }}>
              <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                📋 AI 訊號歷史
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
                </div>
              ) : signals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--t3)" }}>暫無訊號記錄</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {signals.map(sig => (
                    <div key={sig.id} style={{
                      background: "var(--bg)", borderRadius: 10, padding: "0.75rem 1rem",
                      borderLeft: `3px solid ${sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span style={{
                            fontWeight: 700, fontSize: "0.9rem",
                            color: sig.signal_type === "BUY" ? "var(--buy)" : sig.signal_type === "SELL" ? "var(--sell)" : "var(--hold)",
                          }}>
                            {sig.signal_type === "BUY" ? "📈 買進" : sig.signal_type === "SELL" ? "📉 賣出" : "⚖️ 觀望"}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: sig.confidence >= 0.6 ? "var(--green)" : "var(--hold)" }}>
                            {(sig.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "var(--t3)" }}>
                          {new Date(sig.created_at).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.4rem", marginBottom: "0.4rem" }}>
                        {[
                          { label: "進場", value: sig.price, color: "var(--t1)" },
                          { label: "止損", value: sig.stop_loss, color: "var(--sell)" },
                          { label: "止盈", value: sig.target_price, color: "var(--buy)" },
                        ].map(p => (
                          <div key={p.label} style={{ textAlign: "center", background: "var(--bg-card)", borderRadius: 6, padding: "0.3rem" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--t3)" }}>{p.label}</div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: p.color }}>
                              {p.value > 0 ? p.value.toLocaleString() : "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                      {sig.reasoning && (
                        <div style={{ fontSize: "0.78rem", color: "var(--t3)", lineHeight: 1.6 }}>
                          {sig.reasoning.substring(0, 150)}{sig.reasoning.length > 150 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Analysis + Indicators */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* AI Full Reasoning */}
            {latestSignal && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.1rem" }}>
                <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.85rem", fontSize: "0.9rem" }}>
                  🧠 AI 選股理由
                </div>
                <div style={{
                  fontSize: "0.85rem", color: "var(--t2)", lineHeight: 1.8,
                  background: "var(--bg)", borderRadius: 10, padding: "0.85rem",
                }}>
                  {latestSignal.reasoning || "AI 正在分析中..."}
                </div>

                {/* Key Indicators */}
                <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    {
                      label: "技術評分",
                      value: `${latestSignal.technical_score >= 0 ? "+" : ""}${(latestSignal.technical_score * 100).toFixed(0)}`,
                      color: latestSignal.technical_score >= 0.3 ? "var(--buy)" : latestSignal.technical_score <= -0.3 ? "var(--sell)" : "var(--hold)",
                      unit: "%",
                    },
                    {
                      label: "情緒評分",
                      value: `${latestSignal.sentiment_score >= 0 ? "+" : ""}${(latestSignal.sentiment_score * 100).toFixed(0)}`,
                      color: latestSignal.sentiment_score >= 0 ? "var(--buy)" : "var(--sell)",
                      unit: "%",
                    },
                    {
                      label: "AI 信心度",
                      value: `${(latestSignal.confidence * 100).toFixed(0)}`,
                      color: latestSignal.confidence >= 0.6 ? "var(--buy)" : latestSignal.confidence >= 0.4 ? "var(--us)" : "var(--hold)",
                      unit: "%",
                    },
                  ].map(ind => (
                    <div key={ind.label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.5rem 0.75rem", background: "var(--bg)", borderRadius: 8,
                    }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--t3)" }}>{ind.label}</span>
                      <span style={{ fontWeight: 700, color: ind.color, fontSize: "0.9rem" }}>
                        {ind.value}{ind.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stop Loss / Take Profit Box */}
            {latestSignal && latestSignal.price > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.1rem" }}>
                <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.85rem", fontSize: "0.9rem" }}>
                  🎯 操作區間
                </div>
                {[
                  { label: "建議進場", value: latestSignal.price, color: "var(--t1)", desc: "AI 建議進場價" },
                  { label: "🛑 止損價", value: latestSignal.stop_loss, color: "var(--sell)", desc: `跌幅 ${latestSignal.price > 0 ? ((latestSignal.stop_loss - latestSignal.price) / latestSignal.price * 100).toFixed(1) : "0"}%` },
                  { label: "🎯 止盈價", value: latestSignal.target_price, color: "var(--buy)", desc: `漲幅 +${latestSignal.price > 0 ? ((latestSignal.target_price - latestSignal.price) / latestSignal.price * 100).toFixed(1) : "0"}%` },
                ].map(item => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.65rem 0.75rem", marginBottom: "0.4rem",
                    background: "var(--bg)", borderRadius: 8,
                    borderLeft: `2px solid ${item.color}`,
                  }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", color: "var(--t3)" }}>{item.label}</div>
                      <div style={{ fontSize: "0.72rem", color: item.color, opacity: 0.8 }}>{item.desc}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: item.color }}>
                      {item.value > 0 ? item.value.toLocaleString() : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chip Distribution (簡化版) */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.1rem" }}>
              <div style={{ fontWeight: 700, color: "var(--t1)", marginBottom: "0.85rem", fontSize: "0.9rem" }}>
                🏦 籌碼分析
              </div>
              {latestSignal ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    { label: "AI 技術面評分", pct: Math.round((latestSignal.technical_score + 1) / 2 * 100), color: "var(--tw)" },
                    { label: "AI 情緒面評分", pct: Math.round((latestSignal.sentiment_score + 1) / 2 * 100), color: "var(--us)" },
                    { label: "AI 綜合信心", pct: Math.round(latestSignal.confidence * 100), color: "var(--green)" },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
                        <span style={{ color: "var(--t3)" }}>{item.label}</span>
                        <span style={{ color: "var(--t1)", fontWeight: 700 }}>{item.pct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${item.pct}%`, background: item.color }}></div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: "0.73rem", color: "var(--t3)", marginTop: "0.4rem", padding: "0.5rem", background: "var(--bg)", borderRadius: 6 }}>
                    💡 法人籌碼數據需串接 TWSE 或 FinMind API，可在 .env 設定 FINMIND_TOKEN
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--t3)", fontSize: "0.83rem", textAlign: "center", padding: "1rem" }}>
                  暫無籌碼資料
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
