import type { MetadataRoute } from 'next';

// SIT Manager is a private staff app. Only the public Corporate Training page is meant
// for search engines; everything else stays out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/public/corporate-training', '/corporate-training/'], disallow: '/' }],
    sitemap: 'https://suvidya.app/sitemap.xml',
  };
}
