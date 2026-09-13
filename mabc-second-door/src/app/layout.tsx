import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "두번째문 — 의심 메시지 분석·확인 절차",
  description:
    "의심되는 메시지를 붙여넣으면, 판단 대신 멈추고 확인하는 절차를 정리해 드립니다. 키 없이 동작하며 메시지 진위를 판정하지 않습니다.",
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
