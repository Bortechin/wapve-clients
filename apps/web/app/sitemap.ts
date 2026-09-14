import type { MetadataRoute } from 'next';
import { legalSlugs } from '@/lib/legal-content';
import { blogPosts } from '@/lib/public-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-09-01T00:00:00+03:00');
  const marketingRoutes = [
    '',
    '/features',
    '/wapve-plus',
    '/security',
    '/roadmap',
    '/faq',
    '/support',
    '/blog',
  ];
  const pages = [
    ...marketingRoutes.map((route) => ({
      url: `https://wapve.com${route}`,
      lastModified,
      changeFrequency: route === '' ? ('weekly' as const) : ('monthly' as const),
      priority: route === '' ? 1 : 0.7,
    })),
    ...legalSlugs.map((document) => ({
      url: `https://wapve.com/legal/${document}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...blogPosts.map((post) => ({
      url: `https://wapve.com/blog/${post.slug}`,
      lastModified: new Date(`${post.date}T09:00:00+03:00`),
      changeFrequency: 'yearly' as const,
      priority: 0.55,
    })),
  ];
  return pages;
}
