import path from 'node:path';
import type { NextConfig } from 'next';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
const scriptPolicy =
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com https://challenges.cloudflare.com";
const connectPolicy =
  process.env.NODE_ENV === 'development'
    ? "connect-src 'self' http://localhost:4000 ws://localhost:4000"
    : "connect-src 'self' https://cloudflareinsights.com";

type WebpackConfiguration = {
  resolve: { extensionAlias?: Record<string, string[]> };
};

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@wapve/ui', '@wapve/contracts'],
  webpack(configuration: WebpackConfiguration) {
    configuration.resolve.extensionAlias = {
      ...configuration.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return configuration;
  },
  headers() {
    const noIndexHeaders = [
      '/app',
      '/app/:path*',
      '/channels/:path*',
      '/owner',
      '/support/staff',
      '/support/ticket/:path*',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/verify-login',
      '/qr-login',
      '/invite/:path*',
      '/desktop',
      '/tr/:path*',
      '/en/:path*',
    ].map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    }));
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src https://challenges.cloudflare.com; form-action 'self'; object-src 'none'; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; ${connectPolicy} https://challenges.cloudflare.com`,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      ...noIndexHeaders,
    ];
  },
  redirects() {
    return [{ source: '/favicon.ico', destination: '/icon.png', permanent: true }];
  },
  rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
