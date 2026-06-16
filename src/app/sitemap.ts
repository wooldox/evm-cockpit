import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// Emitted as a static sitemap.xml at build time. /ui is the internal component
// gallery — intentionally excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://evm-cockpit.xyz';
  const paths = ['', '/deploy', '/sign', '/history'];
  return paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
