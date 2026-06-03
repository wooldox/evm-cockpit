import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// next/font exposes CSS variables that globals.css maps into Tailwind's
// --font-sans / --font-mono via @theme inline. Don't re-import Google Fonts
// anywhere else — these vars are the single source of truth.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EVM Cockpit",
  description:
    "Read = free, write sends a transaction. Simulate every write before you sign.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dark-first. data-theme on <html> drives the whole token system; it's
  // flipped at runtime by useTheme(). theme-init.js (in /public) re-applies
  // the saved choice before paint, with no inline HTML.
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
