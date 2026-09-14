import { describe, expect, it } from '@jest/globals';
import { parseWapveQr } from './qr-login';

const challengeId = '018f0d7a-91ab-7abc-8def-0123456789ab';
const scanToken = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

describe('parseWapveQr', () => {
  it('accepts only the verified Wapve HTTPS QR shape', () => {
    expect(parseWapveQr(`https://wapve.com/qr-login?challenge=${challengeId}&token=${scanToken}`)).toEqual({ challengeId, token: scanToken });
  });

  it.each([
    `http://wapve.com/qr-login?challenge=${challengeId}&token=${scanToken}`,
    `https://evil.example/qr-login?challenge=${challengeId}&token=${scanToken}`,
    `https://wapve.com/qr-login?challenge=not-a-uuid&token=${scanToken}`,
    `https://wapve.com/qr-login?challenge=${challengeId}&token=short`,
    `https://wapve.com/qr-login?challenge=${challengeId}&token=${scanToken}#spoof`,
  ])('rejects an unsafe QR payload: %s', (value) => {
    expect(parseWapveQr(value)).toBeNull();
  });
});
