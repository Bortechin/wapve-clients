import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wapve',
    short_name: 'Wapve',
    description: 'Topluluklar için güvenli ve sade iletişim platformu.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050816',
    theme_color: '#0b0f24',
    categories: ['social', 'communication'],
    icons: [
      {
        src: '/brand/wapve-icon-v2-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/wapve-icon-v2-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
