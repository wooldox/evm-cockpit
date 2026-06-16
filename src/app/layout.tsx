import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const SITE_URL = 'https://evm-cockpit.xyz';
const SITE_NAME = 'EVM Cockpit';
const DESCRIPTION =
  'Read and write any EVM smart contract, on any chain, right in your ' +
  'browser. Every write is simulated before you sign. Built for developers ' +
  'and auditors.';

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'EVM Cockpit — Read & write any EVM smart contract',
    template: '%s · EVM Cockpit',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'EVM',
    'smart contract',
    'Ethereum',
    'contract explorer',
    'read contract',
    'write contract',
    'transaction simulation',
    'wallet',
    'web3 tools',
    'blockchain developer tools',
    'auditor',
    'ABI',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  // Static PNGs in /public — referenced with explicit .png paths so any host
  // (incl. Vercel static export) serves them as image/png. metadataBase makes
  // og:image absolute, which social scrapers require.
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'EVM Cockpit — Read & write any EVM smart contract',
    description: DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'EVM Cockpit — read & write any EVM smart contract',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EVM Cockpit — Read & write any EVM smart contract',
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c10',
};

// SoftwareApplication structured data — helps search engines understand what
// this is (a free, browser-based developer tool) for richer result cards.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
