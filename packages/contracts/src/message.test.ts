import { describe, expect, it } from 'vitest';
import {
  createPollSchema,
  createMessageSchema,
  messageListQuerySchema,
  messageReactionInputSchema,
  internalMessagePreviewSchema,
  updateMessageSchema,
} from './message.js';

describe('message contracts', () => {
  it('trims valid message content while preserving line breaks', () => {
    expect(createMessageSchema.parse({ content: '  merhaba\ndünya  ' }).content).toBe(
      'merhaba\ndünya',
    );
  });

  it('rejects empty, oversized and directional override content', () => {
    expect(() => createMessageSchema.parse({})).toThrow();
    expect(() => updateMessageSchema.parse({ content: '   ' })).toThrow();
    expect(() => updateMessageSchema.parse({ content: '\u202Ehidden' })).toThrow();
    expect(() => updateMessageSchema.parse({ content: 'güvenli\u202Emetin' })).toThrow();
  });

  it('allows a signed GIF selection without text content', () => {
    expect(createMessageSchema.parse({ gifToken: 'x'.repeat(32) })).toEqual({
      gifToken: 'x'.repeat(32),
    });
  });

  it('coerces and bounds message pagination', () => {
    expect(messageListQuerySchema.parse({ limit: '25' }).limit).toBe(25);
    expect(() => messageListQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('accepts Unicode emoji and rejects control characters', () => {
    expect(messageReactionInputSchema.parse({ emoji: '👋🏽' })).toEqual({ emoji: '👋🏽' });
    expect(() => messageReactionInputSchema.parse({ emoji: '\u0000' })).toThrow();
  });

  it('accepts 2-10 unique poll options', () => {
    expect(
      createPollSchema.parse({
        question: 'Ne yapalım?',
        options: ['Film', 'Oyun'],
        durationMinutes: 1440,
      }).options,
    ).toEqual(['Film', 'Oyun']);
    expect(() =>
      createPollSchema.parse({
        question: 'Tekrar?',
        options: ['Aynı', 'aynı'],
        durationMinutes: 60,
      }),
    ).toThrow();
    expect(() =>
      createPollSchema.parse({ question: 'Eksik?', options: ['Tek'], durationMinutes: 1440 }),
    ).toThrow();
    expect(() =>
      createPollSchema.parse({
        question: 'Süre?',
        options: ['A', 'B'],
        durationMinutes: 30,
      }),
    ).toThrow();
  });

  it('validates internal message preview cards', () => {
    expect(
      internalMessagePreviewSchema.parse({
        url: 'https://wapve.com/channels/123456789012345/181234567890123456#message-018f0d7a-91ab-7abc-8def-0123456789ab',
        kind: 'SERVER',
        author: { displayName: 'LalaŞahinPaşa', avatarUrl: null },
        context: { name: 'EfsunMC', iconUrl: null },
        excerpt: 'örnek mesaj',
      }).context.name,
    ).toBe('EfsunMC');
  });
});
