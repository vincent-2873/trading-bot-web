"use client";
import { useState, useRef, useEffect, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────────────────────────── */
type Role = "user" | "assistant";
interface Msg { role: Role; content: string; id: string; }

/* ── Quick-action chips ──────────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  "分析台積電 2330",
  "聯發科 2454 現在可以買嗎",
  "鴻海 2317 技術面分析",
  "NVDA 最新走勢",
  "現在台股整體氣氛",
  "比特幣 BTC 短期看法",
];

/* ── Typewriter component ────────────────────────────────────────────────────── */
function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function TypewriterText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.7, fontSize: "clamp(0.82rem, 3.8vw, 0.93rem)" }}>
      {lines.map((line, i) => {
        // Escape first, then apply **bold** so AI content can't inject HTML
        const escaped = escapeHtml(line);
        const formatted = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Heading lines (start with #)
        const isHeading = /^#{1,3} /.test(line);
        return (
          <p key={i}
            style={{
              margin: isHeading ? "0.55rem 0 0.2rem" : "0.18rem 0",
              fontSize: isHeading ? "clamp(0.88rem, 4vw, 1rem)" : undefined,
              fontWeight: isHeading ? 700 : undefined,
              color: isHeading ? "var(--green-light)" : undefined,
            }}
            dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }}
          />
        );
      })}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────────── */
export default function AiChatBot() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([
    {
      role: "assistant",
      id: "welcome",
      content: "你好！我是**蛙哥分析師** 🐸🤖\n\n我可以幫你深度分析任何股票，涵蓋：\n• 技術面（3個月/6個月/1年回顧）\n• 籌碼面、法人動向\n• AI 買賣建議 + 目標價\n\n請輸入股票代號或名稱，例如：「分析 2330」",
    },
  ]);
  const [input, setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pulse, setPulse]     = useState(true);
  const [unread, setUnread]   = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Prevent body scroll when chat open on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = open ? "hidden" : "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  // Focus input + clear unread when opened
  useEffect(() => {
    if (open) {
      setPulse(false);
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Msg = { role: "user", content: text.trim(), id: `u-${Date.now()}` };
    const asstId = `a-${Date.now()}`;

    setMsgs(prev => [...prev, userMsg, { role: "assistant", content: "", id: asstId }]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const history = msgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        setMsgs(prev =>
          prev.map(m => m.id === asstId ? { ...m, content: snapshot } : m)
        );
      }

      if (!open) {
        setUnread(n => n + 1);
        setPulse(true);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMsgs(prev =>
          prev.map(m => m.id === asstId ? {
            ...m, content: "抱歉，分析出現問題，請稍後再試。",
          } : m)
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [msgs, streaming, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  /* ── Window dimensions ── */
  // Desktop: floating card  |  Mobile: full-screen sheet
  const winStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        maxHeight: "100dvh",
        borderRadius: 0,
        bottom: 0,
        right: 0,
      }
    : {
        position: "fixed",
        bottom: "5.5rem",
        right: "1.5rem",
        width: "min(440px, calc(100vw - 2rem))",
        height: "min(640px, calc(100vh - 8rem))",
        borderRadius: 20,
      };

  /* ── Floating button position — raised on mobile for home-bar ── */
  const btnBottom = isMobile
    ? "calc(1.2rem + env(safe-area-inset-bottom))"
    : "1.5rem";

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="AI 分析師"
        style={{
          position: "fixed",
          bottom: btnBottom,
          right: "1.25rem",
          width: 56, height: 56,
          borderRadius: "50%",
          background: open
            ? "var(--bg-card)"
            : "linear-gradient(135deg, #22c55e, #0ea5e9)",
          border: `2px solid ${open ? "var(--border)" : "transparent"}`,
          cursor: "pointer",
          zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem",
          boxShadow: open ? "none" : "0 4px 24px rgba(34,197,94,.45)",
          transition: "all .3s ease",
          animation: pulse ? "botPulse 2s ease-in-out infinite" : "none",
          // iOS tap highlight
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {open ? "✕" : "🤖"}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            background: "#f43f5e", color: "#fff",
            borderRadius: "50%", width: 20, height: 20,
            fontSize: "0.65rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg)",
          }}>{unread}</span>
        )}
      </button>

      {/* ── Chat Window ── */}
      {open && (
        <div
          style={{
            ...winStyle,
            background: "var(--bg-card)",
            border: isMobile ? "none" : "1px solid var(--border2)",
            boxShadow: isMobile ? "none" : "0 20px 60px rgba(0,0,0,.7)",
            display: "flex", flexDirection: "column",
            zIndex: 9998,
            animation: "slideUp .22s ease",
            overflow: "hidden",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: isMobile
              ? "calc(0.75rem + env(safe-area-inset-top)) 1rem 0.75rem"
              : "0.9rem 1.1rem",
            background: "linear-gradient(135deg, #0c2a14, #0a1f20)",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: "0.7rem",
            flexShrink: 0,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#22c55e,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.2rem",
            }}>🤖</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "clamp(0.88rem,4vw,0.95rem)", fontWeight: 800, color: "var(--t1)" }}>
                蛙哥 AI 分析師
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--green)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "var(--green)", display: "inline-block",
                  animation: "pulseDot 1.5s ease infinite",
                  flexShrink: 0,
                }} />
                線上・勝率高・即時分析
              </div>
            </div>

            <div style={{ fontSize: "0.62rem", color: "var(--t3)", textAlign: "right", flexShrink: 0 }}>
              每4小時<br />自我訓練 🧠
            </div>

            {/* Mobile close button — bigger touch target */}
            {isMobile && (
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "rgba(255,255,255,.07)",
                  border: "none", cursor: "pointer",
                  color: "var(--t2)", fontSize: "1.1rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}>✕</button>
            )}
          </div>

          {/* ── Messages area ── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: isMobile ? "1rem" : "0.9rem",
            display: "flex", flexDirection: "column",
            gap: isMobile ? "0.9rem" : "0.7rem",
            // iOS momentum scroll
            WebkitOverflowScrolling: "touch",
          }}>
            {msgs.map((msg) => (
              <div key={msg.id} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                gap: "0.5rem", alignItems: "flex-end",
              }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#22c55e,#0ea5e9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.9rem", marginBottom: 2,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: isMobile ? "88%" : "82%",
                  padding: msg.role === "user"
                    ? "0.6rem 1rem"
                    : "0.75rem 1rem",
                  borderRadius: msg.role === "user"
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg,#22c55e,#15803d)"
                    : "var(--bg-card2)",
                  border: msg.role === "user"
                    ? "none"
                    : "1px solid var(--border)",
                  color: "var(--t1)",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}>
                  {msg.content === "" && streaming ? (
                    <div style={{ display: "flex", gap: 5, padding: "4px 2px", alignItems: "center" }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "var(--green)",
                          animation: `pulseDot 1.2s ease ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  ) : (
                    <TypewriterText text={msg.content} />
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* ── Quick actions (only on welcome state) ── */}
          {msgs.length <= 1 && (
            <div style={{
              padding: isMobile ? "0 1rem 0.5rem" : "0 0.9rem 0.5rem",
              // Horizontal scroll on mobile to prevent wrapping
              overflowX: "auto",
              overflowY: "hidden",
              display: "flex",
              gap: "0.4rem",
              flexWrap: isMobile ? "nowrap" : "wrap",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a} onClick={() => sendMessage(a)}
                  style={{
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border)",
                    color: "var(--t2)",
                    borderRadius: 20,
                    padding: isMobile ? "0.35rem 0.9rem" : "0.28rem 0.75rem",
                    fontSize: "clamp(0.72rem, 3.2vw, 0.78rem)",
                    cursor: "pointer",
                    transition: "all .15s",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    minHeight: 36,
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}>
                  {a}
                </button>
              ))}
            </div>
          )}

          {/* ── Input bar ── */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: isMobile
                ? `0.75rem 0.9rem calc(0.75rem + env(safe-area-inset-bottom))`
                : "0.75rem",
              borderTop: "1px solid var(--border)",
              display: "flex", gap: "0.5rem", alignItems: "center",
              background: "var(--bg)",
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={streaming}
              placeholder={streaming ? "分析中..." : "輸入股票代號或名稱..."}
              // 16px minimum prevents iOS auto-zoom
              style={{
                flex: 1,
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "0.6rem 1rem",
                color: "var(--t1)",
                fontSize: "16px",
                outline: "none",
                minHeight: 46,
                WebkitAppearance: "none",
                appearance: "none",
              }}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              style={{
                width: 46, height: 46,
                borderRadius: "50%",
                flexShrink: 0,
                background: streaming || !input.trim()
                  ? "var(--bg-hover)"
                  : "linear-gradient(135deg,#22c55e,#0ea5e9)",
                border: "none",
                cursor: streaming || !input.trim() ? "default" : "pointer",
                color: streaming || !input.trim() ? "var(--t3)" : "#fff",
                fontSize: "1.15rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {streaming ? "⟳" : "▶"}
            </button>
          </form>

          {/* ── Disclaimer ── */}
          <div style={{
            padding: isMobile
              ? "0.3rem 1rem"
              : "0.3rem 1rem",
            background: "var(--bg)",
            fontSize: "0.6rem", color: "var(--t3)", textAlign: "center",
            flexShrink: 0,
          }}>
            AI 分析僅供參考，投資前請評估風險。每4小時自動更新模型。
          </div>
        </div>
      )}

      {/* Styles moved to globals.css to prevent hydration mismatch */}
    </>
  );
}
