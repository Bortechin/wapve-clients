import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  messageDraftKey,
  readMessageDraft,
  removeMessageDraft,
  writeMessageDraft,
} from './message-drafts';

describe('message drafts', () => {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('window', { localStorage });
  });
  afterAll(() => vi.unstubAllGlobals());

  it('isolates drafts by user, kind, and conversation', () => {
    const channel = messageDraftKey('user-1', 'channel', 'channel-1');
    const direct = messageDraftKey('user-1', 'direct', 'channel-1');
    writeMessageDraft(channel, 'kanal taslağı');
    writeMessageDraft(direct, 'özel taslak');

    expect(readMessageDraft(channel)).toBe('kanal taslağı');
    expect(readMessageDraft(direct)).toBe('özel taslak');
  });

  it('removes empty and sent drafts', () => {
    const key = messageDraftKey('user-1', 'group', 'group-1');
    writeMessageDraft(key, 'taslak');
    writeMessageDraft(key, '');
    expect(readMessageDraft(key)).toBe('');

    writeMessageDraft(key, 'yeniden');
    removeMessageDraft(key);
    expect(readMessageDraft(key)).toBe('');
  });
});
