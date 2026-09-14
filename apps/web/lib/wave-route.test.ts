import { describe, expect, it } from 'vitest';
import { decodeWaveConversationSegment } from './wave-route';

describe('decodeWaveConversationSegment', () => {
  it('restores a group conversation prefix encoded into one route segment', () => {
    expect(decodeWaveConversationSegment('group%3A01a02951-09fd-749d-b987-fe5762eb463c')).toBe(
      'group:01a02951-09fd-749d-b987-fe5762eb463c',
    );
  });

  it('keeps an already decoded conversation id stable', () => {
    expect(decodeWaveConversationSegment('group:conversation-id')).toBe('group:conversation-id');
  });

  it('rejects malformed percent encoding', () => {
    expect(decodeWaveConversationSegment('group%3')).toBeNull();
  });
});
