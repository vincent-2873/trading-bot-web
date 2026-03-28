/**
 * 加密貨幣市場數據 API
 * GET /api/crypto → CoinGecko 免費 API，無需 key
 */
import { NextResponse } from "next/server";

export const revalidate = 300; // 5-min cache

const CRYPTO_IDS = [
  "bitcoin", "ethereum", "binancecoin", "solana", "ripple",
  "cardano", "avalanche-2", "polkadot", "chainlink", "uniswap"
];

export async function GET() {
  try {
    // CoinGecko markets API (free, no auth)
    const [marketsRes, fearGreedRes, globalRes] = await Promise.all([
      fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS.join(",")}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d`,
        { headers: { "Accept": "application/json" }, next: { revalidate: 300 } }
      ),
      fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 3600 } }),
      fetch("https://api.coingecko.com/api/v3/global", { next: { revalidate: 600 } }),
    ]);

    const markets    = marketsRes.ok    ? await marketsRes.json()    : [];
    const fearGreed  = fearGreedRes.ok  ? await fearGreedRes.json()  : {};
    const globalData = globalRes.ok     ? await globalRes.json()     : {};

    const fng = fearGreed?.data?.[0] || {};
    const gd  = globalData?.data || {};

    const coins = Array.isArray(markets) ? markets.map((c: Record<string, unknown>) => ({
      id:              c.id,
      symbol:          String(c.symbol || "").toUpperCase(),
      name:            c.name,
      price:           c.current_price,
      change_1h:       c.price_change_percentage_1h_in_currency,
      change_24h:      c.price_change_percentage_24h,
      change_7d:       c.price_change_percentage_7d_in_currency,
      market_cap:      c.market_cap,
      volume_24h:      c.total_volume,
      image:           c.image,
      ath:             c.ath,
      ath_change_pct:  c.ath_change_percentage,
    })) : [];

    return NextResponse.json({
      coins,
      fear_greed: {
        value:       parseInt(fng.value || "50"),
        label:       fng.value_classification || "Neutral",
        label_zh:    translateFearGreed(parseInt(fng.value || "50")),
        timestamp:   fng.timestamp,
      },
      global: {
        btc_dominance:    gd.market_cap_percentage?.btc || 0,
        eth_dominance:    gd.market_cap_percentage?.eth || 0,
        total_market_cap: gd.total_market_cap?.usd || 0,
        market_cap_change_24h: gd.market_cap_change_percentage_24h_usd || 0,
        active_coins:     gd.active_cryptocurrencies || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Crypto API error:", err);
    return NextResponse.json({ coins: [], fear_greed: { value: 50, label_zh: "中立" }, global: {} });
  }
}

function translateFearGreed(value: number): string {
  if (value <= 25) return "極度恐懼 😱";
  if (value <= 40) return "恐懼 😨";
  if (value <= 60) return "中立 😐";
  if (value <= 75) return "貪婪 😊";
  return "極度貪婪 🤑";
}
