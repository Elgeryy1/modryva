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
        {/* Telegram Mini App SDK: exposes window.Telegram.WebApp + initData.
            Served from our OWN origin on purpose — see
            public/README-telegram-sdk.md. Loading it from telegram.org meant a
            blocking cross-origin script Next waits for before hydrating, and
            this app renders nothing server-side: when that fetch never
            resolved, the user sat on a loading skeleton forever, with no
            request ever reaching us to explain why. */}
        <Script src="/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
