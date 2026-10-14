import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "教师宿舍值日签到" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
