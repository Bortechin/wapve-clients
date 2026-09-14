import { describe, expect, it } from 'vitest';
import { marketingCopy } from './marketing-copy';

describe('marketingCopy', () => {
  it('provides complete download navigation and hero links in both languages', () => {
    const tr = marketingCopy('tr');
    const en = marketingCopy('en');

    expect(tr.nav.download).toBe('İndir');
    expect(en.nav.download).toBe('Download');

    expect(tr.hero.downloadWindows).toContain('Windows');
    expect(en.hero.downloadWindows).toContain('Windows');

    expect(tr.hero.downloadVersion).toBe('v0.3.4 (64-bit)');
    expect(en.hero.downloadVersion).toBe('v0.3.4 (64-bit)');

    expect(tr.hero.verifyHash).toBe('SHA-256 Doğrulama');
    expect(en.hero.verifyHash).toBe('SHA-256 Verification');
  });

  it('provides rich download page information and security guidance', () => {
    const tr = marketingCopy('tr');
    const en = marketingCopy('en');

    expect(tr.pages.download.downloadButton).toBeTruthy();
    expect(en.pages.download.downloadButton).toBeTruthy();

    expect(tr.pages.download.securityHeading).toBeTruthy();
    expect(en.pages.download.securityHeading).toBeTruthy();

    expect(tr.pages.download.sha256Label).toBeTruthy();
    expect(en.pages.download.copyCommand).toBeTruthy();
    expect(tr.pages.download.smartScreenTitle).toBeTruthy();
  });
});
