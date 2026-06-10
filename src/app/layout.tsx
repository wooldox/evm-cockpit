import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// next/font exposes CSS variables that globals.css maps into Tailwind's
// --font-sans / --font-mono via @theme inline. Don't re-import Google Fonts
// anywhere else — these vars are the single source of truth.
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EVM Cockpit',
  description:
    'Read = free, write sends a transaction. Simulate every write before you sign.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dark-first. data-theme on <html> drives the whole token system; it's
  // flipped at runtime by useTheme(). The inline <script> in <head> re-applies
  // the saved choice before paint — synchronous so there is no flash.
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('cc-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
