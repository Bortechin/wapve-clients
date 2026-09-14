import { describe, expect, it } from 'vitest';
import { formatMessageDay, startsNewMessageDay } from './message-date';

describe('message date dividers', () => {
  it('starts a divider for the first message and each new calendar day', () => {
    const messages = [
      { createdAt: '2026-08-20T08:00:00.000Z' },
      { createdAt: '2026-08-20T20:00:00.000Z' },
      { createdAt: '2026-08-21T08:00:00.000Z' },
    ];

    expect(startsNewMessageDay(messages, 0)).toBe(true);
    expect(startsNewMessageDay(messages, 1)).toBe(false);
    expect(startsNewMessageDay(messages, 2)).toBe(true);
  });

  it('formats a clear localized date label', () => {
    expect(formatMessageDay('2026-08-20T08:00:00.000Z', 'tr-TR')).toContain('20 Ağustos 2026');
  });
});
