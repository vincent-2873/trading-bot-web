import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "半導體": ["台積電","聯發科","TSMC","tsmc","半導體","晶圓","IC","NVIDIA","nvidia","AMD","amd","Intel","intel","三星","高通","博通","應材","製程"],
  "科技": ["蘋果","Apple","Google","Microsoft","Meta","AI","人工智慧","科技","軟體","雲端","AWS","Azure","OpenAI"],
  "金融": ["央行","Fed","fed","升息","降息","銀行","金融","CPI","通膨","債券","美元","利率","聯準會","貨幣","財政"],
  "能源": ["石油","原油","黃金","天然氣","能源","油","黃金","原物料","煤炭","核能","綠能","太陽能","風電"],
  "加密貨幣": ["比特幣","以太幣","Bitcoin","bitcoin","Ethereum","ethereum","加密","BTC","ETH","SOL","幣","crypto","DeFi","NFT","Web3"],
  "電動車": ["特斯拉","Tesla","tesla","電動車","EV","新能源","比亞迪","蔚來","小鵬","造車"],
  "總經": ["GDP","PMI","就業","失業","財報","景氣","衰退","通脹","成長率","製造業","服務業","出口","進口"],
  "台股": ["台股","加權指數","台灣","鴻海","廣達","緯創","聯電","日月光","長榮","陽明","元大","富邦","國泰","玉山"],
};

function classifyIndustry(title: string, summary: string = ""): string {
  const text = (title + " " + summary).toLowerCase();
  let best = "其他", bestScore = 0;
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
    if (score > bestScore) { best = industry; bestScore = score; }
  }
  return best;
}

const RSS: Record<string, string> = {
  TW:      "https://news.google.com/rss/search?q=台股+投資+選股&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  US:      "https://news.google.com/rss/search?q=stock+market+nasdaq+S%26P500&hl=en-US&gl=US&ceid=US:en",
  CRYPTO:  "https://news.google.com/rss/search?q=比特幣+以太坊+加密貨幣&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  FUTURES: "https://news.google.com/rss/search?q=期貨+台指期+黃金+原油&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
  ALL:     "https://news.google.com/rss/search?q=台股+財經+投資+ETF&hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
};

function parseRSS(xml: string) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  return items.slice(0, 20).map((item, idx) => {
    const get = (tag: string) =>
      item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]
        ?.replace(/<!\[CDATA\[|\]\]>/g, "")
        .trim() || "";

    const title   = get("title");
    const link    = get("link") || get("guid");
    const pubDate = get("pubDate");
    const source  = get("source") || get("name");
    const desc    = get("description").replace(/<[^>]+>/g, "").substring(0, 200);

    // Simple sentiment scoring based on keywords
    const pos = ["上漲","利多","突破","創新高","買超","反彈","回升","bull","surge","rally","gain","rise"];
    const neg = ["下跌","利空","跌破","新低","賣超","暴跌","崩盤","bear","crash","drop","fall","plunge"];
    const text = (title + desc).toLowerCase();
    const posCount = pos.filter(w => text.includes(w)).length;
    const negCount = neg.filter(w => text.includes(w)).length;
    const sentiment = posCount > negCount ? "POSITIVE" : negCount > posCount ? "NEGATIVE" : "NEUTRAL";
    const sentiment_score = posCount > negCount ? 0.6 : negCount > posCount ? -0.6 : 0;

    return {
      id: `rss_${idx}_${Date.now()}`,
      title,
      url: link,
      source: source || "Google 財經新聞",
      description: desc,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sentiment,
      sentiment_score,
      industry: classifyIndustry(title, desc),
    };
  }).filter(n => n.title);
}

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get("market") || "ALL";
  const keyword = req.nextUrl.searchParams.get("q") || "";
  const industryFilter = req.nextUrl.searchParams.get("industry") || "";

  try {
    // 1. Check Supabase for recent news (last 3 hours)
    const db = supabaseAdmin();
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    const dbQuery = db.from("news")
      .select("id,title,url,source,description:summary,published_at,sentiment,sentiment_score")
      .gte("published_at", threeHoursAgo)
      .order("published_at", { ascending: false })
      .limit(20);

    const { data: dbNews } = await dbQuery;
    if (dbNews && dbNews.length >= 5) {
      let filtered = keyword
        ? dbNews.filter(n => n.title?.toLowerCase().includes(keyword.toLowerCase()))
        : dbNews;
      // Add industry classification
      const withIndustry = filtered.map(n => ({
        ...n,
        industry: classifyIndustry(n.title || "", n.description || ""),
      }));
      // Apply industry filter
      const result = (industryFilter && industryFilter !== "全部")
        ? withIndustry.filter(n => n.industry === industryFilter)
        : withIndustry;
      return NextResponse.json({ news: result, source: "db" });
    }

    // 2. Fallback: fetch from Google News RSS
    const rssUrl = RSS[market] || RSS.ALL;
    const searchUrl = keyword
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + " 財經 台股")}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
      : rssUrl;

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate: 900 }, // cache 15 minutes
    });

    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    const allNews = parseRSS(xml);

    // Apply industry filter
    const news = (industryFilter && industryFilter !== "全部")
      ? allNews.filter(n => n.industry === industryFilter)
      : allNews;

    return NextResponse.json({ news, source: "rss" });
  } catch (e) {
    console.error("[NEWS API]", e);
    return NextResponse.json({ news: [], error: String(e) }, { status: 500 });
  }
}
