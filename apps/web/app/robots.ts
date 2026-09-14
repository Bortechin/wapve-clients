import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/features',
        '/wapve-plus',
        '/security',
        '/roadmap',
        '/faq',
        '/support',
        '/blog',
        '/legal/',
      ],
      disallow: [
        '/api/',
        '/app',
        '/channels/',
        '/owner',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/verify-login',
        '/qr-login',
        '/invite/',
        '/desktop',
        '/tr/',
        '/en/',
      ],
    },
    sitemap: 'https://wapve.com/sitemap.xml',
    host: 'https://wapve.com',
  };
}
