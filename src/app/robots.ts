import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// Emitted as a static robots.txt at build time.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/ui' },
    sitemap: 'https://evmcockpit.xyz/sitemap.xml',
    host: 'https://evmcockpit.xyz',
  };
}
