/**
 * 即時價格 API
 * GET /api/prices?symbols=2330,NVDA,ES=F&markets=TW,US,FUTURES
 *
 * 台股：TWSE mis.twse.com.tw 官方即時行情
 * 美股/期貨：Yahoo Finance v8 API
 */
import { NextRequest, NextResponse } from "next/server";

// 名稱對照表
const TW_NAMES: Record<string, string> = {
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
};

const US_NAMES: Record<string, string> = {
  "NVDA": "NVIDIA", "TSLA": "Tesla", "AAPL": "Apple",
  "MSFT": "Microsoft", "AMZN": "Amazon", "GOOGL": "Alphabet",
  "META": "Meta", "AMD": "AMD", "INTC": "Intel",
  "NFLX": "Netflix", "UBER": "Uber",
  "ES=F": "S&P500期貨", "NQ=F": "那斯達克期貨",
  "YM=F": "道瓊期貨", "RTY=F": "羅素2000期貨",
  "GC=F": "黃金期貨", "CL=F": "原油期貨",
  "BTC-USD": "比特幣", "ETH-USD": "以太幣",
};

export const revalidate = 0; // No caching

async function fetchTwsePrice(symbol: string): Promise<{ price: number; change: number; changePercent: number; name: string } | null> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Referer": "https://mis.twse.com.tw/",
    "Accept": "application/json",
  };

  for (const exchange of ["tse", "otc"]) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exchange}_${symbol}.tw&json=1&delay=0`;
      const res = await fetch(url, { headers, next: { revalidate: 0 } });
      if (!res.ok) continue;

      const data = await res.json();
      const msgs = data?.msgArray;
      if (!msgs || msgs.length === 0) continue;

      const msg = msgs[0];
      const name = msg.n || TW_NAMES[symbol] || symbol;

      // 取得價格：z=成交價，y=昨收
      let price = 0;
      const z = msg.z;
      const y = msg.y;
      if (z && z !== "-" && z !== "") price = parseFloat(z);
      else if (y && y !== "-" && y !== "") price = parseFloat(y);

      if (price <= 0) continue;

      const prevClose = y && y !== "-" ? parseFloat(y) : price;
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return { price, change, changePercent, name };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchYahooPrice(symbol: string, isTW = false): Promise<{ price: number; change: number; changePercent: number; name: string } | null> {
  try {
    const ticker = isTW ? `${symbol}.TW` : symbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice || meta?.previousClose || 0;
    const prevClose = meta?.chartPreviousClose || meta?.previousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const name = isTW
      ? (TW_NAMES[symbol] || meta?.shortName || symbol)
      : (US_NAMES[symbol] || meta?.shortName || meta?.longName || symbol);

    return { price, change, changePercent, name };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const marketsParam = searchParams.get("markets") || "";

  const symbolList = symbolsParam.split(",").filter(Boolean).map(s => s.trim());
  const marketList = marketsParam.split(",").filter(Boolean).map(m => m.trim());

  if (symbolList.length === 0) {
    return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
  }

  const results: Record<string, {
    symbol: string; name: string; price: number;
    change: number; changePercent: number; market: string;
  }> = {};

  await Promise.all(
    symbolList.map(async (symbol, i) => {
      const market = marketList[i] || "US";
      let info = null;

      if (market === "TW") {
        // Try TWSE first, fallback to Yahoo Finance
        info = await fetchTwsePrice(symbol);
        if (!info || info.price <= 0) {
          info = await fetchYahooPrice(symbol, true);
        }
      } else {
        info = await fetchYahooPrice(symbol, false);
      }

      if (info && info.price > 0) {
        results[symbol] = {
          symbol,
          name: info.name,
          price: info.price,
          change: Math.round(info.change * 100) / 100,
          changePercent: Math.round(info.changePercent * 100) / 100,
          market,
        };
      } else {
        results[symbol] = {
          symbol,
          name: market === "TW" ? (TW_NAMES[symbol] || symbol) : (US_NAMES[symbol] || symbol),
          price: 0,
          change: 0,
          changePercent: 0,
          market,
        };
      }
    })
  );

  return NextResponse.json({ prices: results, timestamp: new Date().toISOString() });
}
