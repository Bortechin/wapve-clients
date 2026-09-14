import { describe, expect, it } from 'vitest';
import {
  channelNotificationPreferenceSchema,
  serverNotificationPreferenceSchema,
  updateChannelNotificationPreferenceSchema,
  updateServerNotificationPreferenceSchema,
} from './notification.js';

describe('notification preference contracts', () => {
  it('accepts server and inherited channel preferences', () => {
    expect(
      serverNotificationPreferenceSchema.parse({
        level: 'MENTIONS_ONLY',
        mutedUntil: null,
        mutedIndefinitely: false,
        mutePreset: null,
        isMuted: false,
      }).level,
    ).toBe('MENTIONS_ONLY');
    expect(
      channelNotificationPreferenceSchema.parse({
        level: null,
        effectiveLevel: 'ALL_MESSAGES',
        mutedUntil: null,
        mutedIndefinitely: false,
        mutePreset: null,
        isMuted: false,
      }).effectiveLevel,
    ).toBe('ALL_MESSAGES');
  });

  it('validates notification levels, channel inheritance and mute durations', () => {
    expect(updateServerNotificationPreferenceSchema.parse({ mute: 'HOURS_8' }).mute).toBe(
      'HOURS_8',
    );
    expect(updateChannelNotificationPreferenceSchema.parse({ level: null }).level).toBeNull();
    expect(() => updateServerNotificationPreferenceSchema.parse({})).toThrow();
    expect(() => updateChannelNotificationPreferenceSchema.parse({ level: 'INVALID' })).toThrow();
  });
});
