import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';
import './appearance.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://wapve.com'),
  title: { default: 'Wapve — Kendi dalgan', template: '%s · Wapve' },
  description:
    'Topluluklar, arkadaşlar ve ekipler için güvenli sesli, görüntülü ve yazılı iletişim platformu.',
  applicationName: 'Wapve',
  authors: [{ name: 'Wapve', url: 'https://wapve.com' }],
  creator: 'Wapve',
  publisher: 'Wapve',
  category: 'communication',
  keywords: ['Wapve', 'topluluk', 'sesli sohbet', 'görüntülü görüşme', 'mesajlaşma', 'sunucu'],
  icons: {
    icon: [{ url: '/brand/wapve-icon-v2-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/brand/wapve-icon-v2-192.png', type: 'image/png', sizes: '192x192' }],
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'Wapve',
    title: 'Wapve',
    description: 'Topluluklar için güvenli sesli, görüntülü ve yazılı iletişim platformu.',
    url: 'https://wapve.com',
    locale: 'tr_TR',
    alternateLocale: ['en_US'],
    images: [
      { url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Wapve — Kendi dalgan' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wapve',
    description: 'Topluluklar için güvenli sesli, görüntülü ve yazılı iletişim platformu.',
    images: ['/twitter-image.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Apply the device palette before the first paint. */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
