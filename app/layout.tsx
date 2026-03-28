import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import AiChatBot from "@/components/AiChatBot";

export const metadata: Metadata = {
  title: "🐸 呱呱投資俱樂部 - AI 智能選股",
  description: "AI 驅動的台股、美股、期貨、加密貨幣交易訊號平台，透過 Claude AI 深度分析自動推播 LINE 通知",
  keywords: ["台股", "美股", "期貨", "加密貨幣", "AI選股", "LINE通知", "投資"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#05100a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        {children}
        <AiChatBot />
      </body>
    </html>
  );
}
