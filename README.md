# trading-bot-web — 呱呱投資俱樂部 Web Dashboard

Next.js 16 Web 介面，顯示 AI 交易機器人產生的訊號、持倉、績效。配合背景 Python 服務 [`trading-bot`](https://github.com/vincent-2873/trading-bot) 一起使用。

## 架構

- **前端**：Next.js 16 + React 19 + Tailwind CSS 4
- **圖表**：lightweight-charts (TradingView) + recharts
- **資料**：Supabase（與 `trading-bot` Python 核心共用同一個 DB）
- **AI**：Anthropic Claude SDK
- **登入**：LINE Login
- **推播**：LINE Messaging API Webhook

## 本地開發

```bash
npm install
cp .env.example .env.local  # 填入實際值
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

## 環境變數

見 `.env.example`。正式環境變數設定在 Zeabur。

## 部署

- **Zeabur**：push 到 `main` 分支 → 自動 build + deploy 到 `trading-bot-web.zeabur.app`
- **CI**：每次 push / PR 會跑 type check + build（見 `.github/workflows/ci.yml`）

## 相關專案

| Repo | 角色 |
|---|---|
| `trading-bot-web`（本專案） | Web Dashboard |
| `trading-bot` | Python 排程 + 訊號引擎（在 Zeabur Docker 背景跑） |
