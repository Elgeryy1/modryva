import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Modryva",
  description: "Panel y Mini App de Modryva para Telegram",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Telegram Mini App SDK: exposes window.Telegram.WebApp + initData. */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
