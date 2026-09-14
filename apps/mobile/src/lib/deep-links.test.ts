import { describe, expect, it } from '@jest/globals';
import {
  decodeRouteSegment,
  deepLinkReturnPath,
  isUuid,
  messageIdFromUrl,
  safeReturnPath,
} from './deep-links';

const id = '018f0d7a-91ab-7abc-8def-0123456789ab';

describe('mobile deep links', () => {
  it('reads a message hash without accepting arbitrary fragments', () => {
    expect(messageIdFromUrl(`https://wapve.com/waves/group%3A${id}#message-${id}`)).toBe(id);
    expect(messageIdFromUrl('https://wapve.com/waves/test#message-not-an-id')).toBeNull();
  });

  it('keeps only supported local return paths', () => {
    expect(safeReturnPath(`/channels/123/456?messageId=${id}`)).toContain('/channels/');
    expect(safeReturnPath('//evil.example/path')).toBeNull();
    expect(safeReturnPath('/auth/login')).toBeNull();
  });

  it('supports encoded wave segments and valid UUIDs', () => {
    expect(decodeRouteSegment(`group%3A${id}`)).toBe(`group:${id}`);
    expect(isUuid(id)).toBe(true);
    expect(deepLinkReturnPath('/waves/example', id)).toBe(`/waves/example?messageId=${id}`);
  });
});
