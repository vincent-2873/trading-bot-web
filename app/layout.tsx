import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐸 呱呱投資俱樂部 - AI 智能選股",
  description: "AI 驅動的台股、美股、期貨、加密貨幣交易訊號平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ background: "#0a0e1a", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
