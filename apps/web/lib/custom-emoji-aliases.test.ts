import { describe, expect, it } from 'vitest';
import { canonicalizeCustomEmojiAliases } from './custom-emoji-aliases';

const emoji = { id: '019c0000-0000-7000-8000-000000000001', name: 'asd' };

describe('canonicalizeCustomEmojiAliases', () => {
  it('resolves a known alias case-insensitively', () => {
    expect(canonicalizeCustomEmojiAliases(':ASD:', [emoji])).toBe(
      '<:asd:019c0000-0000-7000-8000-000000000001>',
    );
  });

  it('keeps unknown and canonical tokens intact', () => {
    const canonical = '<:asd:019c0000-0000-7000-8000-000000000001>';
    expect(canonicalizeCustomEmojiAliases(`:yok: ${canonical}`, [emoji])).toBe(
      `:yok: ${canonical}`,
    );
  });
});
