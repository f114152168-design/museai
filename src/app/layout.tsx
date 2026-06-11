import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Museai - AI 音樂創作平台 | 用 AI 生成 MIDI 樂譜，一鍵匯出音檔",
  description: "Museai 是 AI 驅動的音樂創作 SaaS 平台。輸入文字描述，AI 即時生成 MIDI 樂譜，鋼琴卷軸編輯，三種創作模式，支援 WAV 匯出。免費開始，升級 Pro 解鎖完整編曲。",
  keywords: ["AI 音樂", "音樂生成", "MIDI 編輯", "即時編程", "電子音樂", "SaaS 音樂平台", "AI 作曲"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
        </Providers>
      </body>
    </html>
  );
}