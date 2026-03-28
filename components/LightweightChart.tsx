"use client";
import { useEffect, useRef, useState } from "react";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

interface Props {
  symbol: string;
  market: string;
  height?: number;
  mini?: boolean;  // mini mode for dashboard overview
}

export default function LightweightChart({ symbol, market, height = 480, mini = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let cleanup = false;

    async function initChart() {
      try {
        // Dynamic import to avoid SSR issues
        const LWC = await import("lightweight-charts");
        const {
          createChart,
          ColorType,
          CrosshairMode,
          CandlestickSeries,
          LineSeries,
          HistogramSeries,
          AreaSeries,
        } = LWC;

        if (cleanup || !containerRef.current) return;

        // Fetch OHLCV data
        const period = mini ? "1mo" : "3mo";
        const res = await fetch(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&market=${market}&period=${period}`);
        const data = await res.json();

        if (!data.candles || data.candles.length === 0) {
          setError("暫無K線數據");
          setLoading(false);
          return;
        }

        if (cleanup || !containerRef.current) return;

        // Create chart
        chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: height,
          layout: {
            background: { type: ColorType.Solid, color: mini ? "transparent" : "#0a1a0f" },
            textColor: "#9ca3af",
            fontSize: mini ? 10 : 12,
          },
          grid: {
            vertLines: { color: mini ? "transparent" : "#1a2e1a", visible: !mini },
            horzLines: { color: mini ? "transparent" : "#1a2e1a", visible: !mini },
          },
          crosshair: {
            mode: mini ? CrosshairMode.Hidden : CrosshairMode.Normal,
          },
          timeScale: {
            borderColor: "#1a2e1a",
            timeVisible: !mini,
            tickMarkFormatter: (time: number) => {
              const d = new Date(time * 1000);
              return mini
                ? `${d.getMonth() + 1}/${d.getDate()}`
                : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
            },
          },
          rightPriceScale: { borderColor: "#1a2e1a", visible: !mini },
          handleScroll: !mini,
          handleScale: !mini,
        });

        if (!mini) {
          // Candlestick series (v5 API: addSeries(CandlestickSeries, options))
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#00c853",
            downColor: "#ef4444",
            borderVisible: false,
            wickUpColor: "#00c853",
            wickDownColor: "#ef4444",
          });
          candleSeries.setData(data.candles);

          // MA5 line (orange)
          if (data.ma5?.length > 0) {
            const ma5Series = chart.addSeries(LineSeries, {
              color: "#f97316",
              lineWidth: 1,
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            ma5Series.setData(data.ma5);
          }

          // MA20 line (blue)
          if (data.ma20?.length > 0) {
            const ma20Series = chart.addSeries(LineSeries, {
              color: "#60a5fa",
              lineWidth: 1,
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            ma20Series.setData(data.ma20);
          }

          // Volume series (bottom panel)
          const volSeries = chart.addSeries(HistogramSeries, {
            color: "#22c55e44",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
          });
          chart.priceScale("volume").applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
            visible: false,
          });
          volSeries.setData(data.candles.map((c: Candle) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "#22c55e44" : "#ef444444",
          })));
        } else {
          // Mini mode: just area chart
          const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: "#00c853",
            topColor: "#00c85322",
            bottomColor: "transparent",
            lineWidth: 2,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          areaSeries.setData(data.candles.map((c: Candle) => ({ time: c.time, value: c.close })));
        }

        chart.timeScale().fitContent();
        setLoading(false);

        // Responsive resize
        const resizeObserver = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);

      } catch (err) {
        console.error("Chart error:", err);
        setError("圖表載入失敗");
        setLoading(false);
      }
    }

    initChart();

    return () => {
      cleanup = true;
      if (chart) chart.remove();
    };
  }, [symbol, market, height, mini]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      {loading && !error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: mini ? "transparent" : "#0a1a0f",
          color: "#9ca3af", fontSize: "0.85rem", gap: "0.5rem",
        }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          載入K線數據...
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#6b7280", fontSize: "0.8rem",
        }}>
          {error}
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height }} />
      {!mini && !loading && !error && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          display: "flex", gap: "0.75rem", fontSize: "0.7rem",
          pointerEvents: "none",
        }}>
          <span style={{ color: "#f97316" }}>— MA5</span>
          <span style={{ color: "#60a5fa" }}>— MA20</span>
        </div>
      )}
    </div>
  );
}
