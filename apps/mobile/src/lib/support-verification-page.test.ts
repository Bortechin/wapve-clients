import { expect, it } from '@jest/globals';
import { supportVerificationHtml } from './support-verification-page';

it('rejects script injection through the public site key', () => {
  expect(() => supportVerificationHtml("x';alert(1)//", 'tr')).toThrow();
  expect(() => supportVerificationHtml('</script>', 'tr')).toThrow();
});
it('uses the real challenge provider and clears expired tokens', () => {
  const html = supportVerificationHtml('0xValid-key', 'tr');
  expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
  expect(html).toContain("'expired-callback':function(){send('',false)}");
  expect(html).toContain("language:'tr'");
  expect(html).not.toContain('/support/mobile-verification');
  expect(supportVerificationHtml('key', '<script>')).toContain("language:'en'");
});
