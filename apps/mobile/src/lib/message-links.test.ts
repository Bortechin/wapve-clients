import { describe, expect, it } from '@jest/globals';
import { firstHttpUrl, parseMobileMessageLink } from './message-links';

const messageId = '018f0d7a-91ab-7abc-8def-0123456789ad';

describe('mobile message links', () => {
  it('parses channel, direct and encoded group links', () => {
    expect(
      parseMobileMessageLink(
        `https://wapve.com/channels/018f0d7a-91ab-7abc-8def-0123456789aa/018f0d7a-91ab-7abc-8def-0123456789ab#message-${messageId}`,
      ),
    ).toMatchObject({ kind: 'channel', messageId });
    expect(
      parseMobileMessageLink(
        `https://wapve.com/waves/018f0d7a-91ab-7abc-8def-0123456789ac#message-${messageId}`,
      ),
    ).toMatchObject({ kind: 'direct', messageId });
    expect(
      parseMobileMessageLink(
        `https://wapve.com/waves/group%3A018f0d7a-91ab-7abc-8def-0123456789ac#message-${messageId}`,
      ),
    ).toMatchObject({ kind: 'group', messageId });
  });

  it('rejects lookalike and credentialed links', () => {
    expect(
      parseMobileMessageLink(`https://wapve.com.evil.test/waves/x#message-${messageId}`),
    ).toBeNull();
    expect(
      parseMobileMessageLink(`https://user@wapve.com/waves/x#message-${messageId}`),
    ).toBeNull();
  });

  it('extracts a URL without trailing punctuation', () => {
    expect(firstHttpUrl('bak https://wapve.com/test).')).toBe('https://wapve.com/test');
  });
});
