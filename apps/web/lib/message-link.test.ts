import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeMessageHash,
  copyTextPreservingScroll,
  isSameMessageRoute,
  messageIdFromHash,
  parseInternalMessageLink,
} from './message-link';

afterEach(() => vi.unstubAllGlobals());

describe('message links', () => {
  it('consumes a matching message hash without changing the current route or query', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        hash: '#message-018f0d7a-91ab-7abc-8def-0123456789ab',
        pathname: '/waves/conversation',
        search: '?view=compact',
      },
      history: { state: { retained: true }, replaceState },
    });

    consumeMessageHash('018f0d7a-91ab-7abc-8def-0123456789ab');

    expect(replaceState).toHaveBeenCalledWith(
      { retained: true },
      '',
      '/waves/conversation?view=compact',
    );
  });

  it('leaves unrelated hashes untouched', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: { hash: '#settings', pathname: '/waves', search: '' },
      history: { state: null, replaceState },
    });

    consumeMessageHash('018f0d7a-91ab-7abc-8def-0123456789ab');

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('bypasses a framework-patched history method while consuming the hash', () => {
    const patchedReplaceState = vi.fn();
    const nativeReplaceState = vi.fn();
    vi.stubGlobal('window', {
      History: { prototype: { replaceState: nativeReplaceState } },
      location: {
        hash: '#message-018f0d7a-91ab-7abc-8def-0123456789ab',
        pathname: '/channels/123456789012345/181234567890123456',
        search: '',
      },
      history: { state: { nextTree: true }, replaceState: patchedReplaceState },
    });

    consumeMessageHash('018f0d7a-91ab-7abc-8def-0123456789ab');

    expect(nativeReplaceState).toHaveBeenCalledWith(
      { nextTree: true },
      '',
      '/channels/123456789012345/181234567890123456',
    );
    expect(patchedReplaceState).not.toHaveBeenCalled();
  });

  it('parses valid server, direct and group message routes into local navigation targets', () => {
    const messageId = '018f0d7a-91ab-7abc-8def-0123456789ab';
    expect(
      parseInternalMessageLink(
        `https://wapve.com/channels/123456789012345/181234567890123456#message-${messageId}`,
        'https://wapve.com',
      ),
    ).toEqual({
      href: `/channels/123456789012345/181234567890123456#message-${messageId}`,
      messageId,
      pathname: '/channels/123456789012345/181234567890123456',
    });
    expect(
      parseInternalMessageLink(
        `https://wapve.com/waves/018f0d7a-91ab-7abc-8def-0123456789ab#message-${messageId}`,
        'https://wapve.com',
      )?.messageId,
    ).toBe(messageId);
    expect(
      parseInternalMessageLink(
        `https://wapve.com/waves/group%3A018f0d7a-91ab-7abc-8def-0123456789ab#message-${messageId}`,
        'https://wapve.com',
      )?.messageId,
    ).toBe(messageId);
  });

  it.each([
    'https://wapve.com.evil.test/channels/123456789012345/181234567890123456#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://user@wapve.com/channels/123456789012345/181234567890123456#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://wapve.com:8443/channels/123456789012345/181234567890123456#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://wapve.com/channels/123456789012345/181234567890123456?next=https://evil.test#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://wapve.com/channels/123456789012345/18%2F123456789012345#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://wapve.com/channels//181234567890123456#message-018f0d7a-91ab-7abc-8def-0123456789ab',
    'https://wapve.com/channels/123456789012345/181234567890123456#message-not-a-uuid',
  ])('rejects unsafe or malformed message links: %s', (value) => {
    expect(parseInternalMessageLink(value, 'https://wapve.com')).toBeNull();
  });

  it('only accepts canonical UUID message hashes', () => {
    expect(messageIdFromHash('#message-018f0d7a-91ab-7abc-8def-0123456789ab')).toBe(
      '018f0d7a-91ab-7abc-8def-0123456789ab',
    );
    expect(messageIdFromHash('#message-018f0d7a91ab-7abc-8def-0123456789ab-')).toBeNull();
  });

  it('matches encoded group routes without confusing a different conversation', () => {
    expect(
      isSameMessageRoute(
        '/waves/group:018f0d7a-91ab-7abc-8def-0123456789ab',
        '/waves/group%3A018f0d7a-91ab-7abc-8def-0123456789ab/',
      ),
    ).toBe(true);
    expect(
      isSameMessageRoute(
        '/waves/018f0d7a-91ab-7abc-8def-0123456789ab',
        '/waves/118f0d7a-91ab-7abc-8def-0123456789ab',
      ),
    ).toBe(false);
  });

  it('restores the conversation scroll position after copying', async () => {
    const container = {
      scrollTop: 420,
      scrollLeft: 7,
      style: { overflowAnchor: '' },
    } as unknown as HTMLElement;
    const writeText = vi.fn(() => {
      container.scrollTop = 0;
      container.scrollLeft = 0;
      return Promise.resolve();
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('window', {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
    });

    await copyTextPreservingScroll('https://wapve.com/waves/test#message-id', container);

    expect(writeText).toHaveBeenCalledOnce();
    expect(container.scrollTop).toBe(420);
    expect(container.scrollLeft).toBe(7);
    expect(container.style.overflowAnchor).toBe('');
  });
});
