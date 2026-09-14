import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SERVER_SUPPORT_LEVELS } from '@wapve/contracts';
import { describe, expect, it } from 'vitest';
import { SUPPORT_ARTICLES, SUPPORT_BRAND_LOGO_SRC, SUPPORT_CATEGORIES } from './support-data';
import { formatSupportArticleHtml } from './support-markdown';

describe('support center content', () => {
  it('uses a real local Wapve brand asset', () => {
    const asset = resolve(process.cwd(), 'public', SUPPORT_BRAND_LOGO_SRC.replace(/^\//u, ''));
    expect(SUPPORT_BRAND_LOGO_SRC).toBe('/brand/wapve-wave-mark-v2.png');
    expect(existsSync(asset)).toBe(true);
  });

  it('keeps every article attached to a unique, existing category', () => {
    const categoryIds = new Set(SUPPORT_CATEGORIES.map(({ id }) => id));
    expect(categoryIds.has('billing')).toBe(false);
    expect(new Set(SUPPORT_CATEGORIES.map(({ slug }) => slug)).size).toBe(
      SUPPORT_CATEGORIES.length,
    );
    expect(new Set(SUPPORT_ARTICLES.map(({ slug }) => slug)).size).toBe(SUPPORT_ARTICLES.length);
    expect(SUPPORT_ARTICLES.every(({ categoryId }) => categoryIds.has(categoryId))).toBe(true);
  });

  it('derives published Woost capacities from the shared product contract', () => {
    const article = SUPPORT_ARTICLES.find(({ id }) => id === 'what-is-woost-server-support');
    expect(article).toBeDefined();
    for (const level of SERVER_SUPPORT_LEVELS) {
      expect(article?.content.tr).toContain(`${level.requiredSupports} Woost`);
      expect(article?.content.tr).toContain(`${level.emojiSlots} emoji yuvası`);
      expect(article?.content.tr).toContain(`${level.voiceBitrateKbps} kbps ses`);
    }
  });

  it('states the current free Wapve+ model and its unsupported limits plainly', () => {
    const article = SUPPORT_ARTICLES.find(({ id }) => id === 'wapve-plus-subscription-perks');
    expect(article?.content.tr).toContain('tüm aktif hesaplarda süresiz ve ücretsiz');
    expect(article?.content.tr).toContain('Ödeme yöntemi, deneme süresi, otomatik yenileme');
    expect(article?.content.tr).toContain('Hareketli avatar/banner');
    expect(article?.content.tr).toContain('şu anda sunulmaz');
  });
});

describe('support article formatter', () => {
  it('escapes raw HTML and does not turn non-HTTPS markdown into a link', () => {
    const html = formatSupportArticleHtml(
      '### Test\n\n<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert(1))',
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders HTTPS links, ordered lists, tables, and fenced code as semantic blocks', () => {
    const html = formatSupportArticleHtml(
      '1. One\n2. Two\n\n| A | B |\n| --- | --- |\n| C | D |\n\n[Wapve](https://wapve.com)\n\n```js\nconst ok = true;\n```',
    );
    expect(html).toContain('<ol><li>One</li><li>Two</li></ol>');
    expect(html).toContain('<table>');
    expect(html).toContain('<a href="https://wapve.com">Wapve</a>');
    expect(html).toContain('<pre><code>const ok = true;</code></pre>');
  });
});
