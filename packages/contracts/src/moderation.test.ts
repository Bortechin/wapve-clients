import { describe, expect, it } from 'vitest';
import {
  auditLogQuerySchema,
  autoModConfigSchema,
  banMemberSchema,
  createServerRoleSchema,
  customServerRoleSchema,
  serverPermissionSchema,
  timeoutMemberSchema,
} from './moderation.js';

describe('moderation contracts', () => {
  it('normalizes role colors and rejects duplicate permissions', () => {
    const parsed = createServerRoleSchema.parse({
      name: 'Moderatör',
      color: '#3b82f6',
      permissions: ['KICK_MEMBERS'],
    });
    expect(parsed.color).toBe('#3B82F6');
    expect(
      createServerRoleSchema.safeParse({
        name: 'Tekrar',
        permissions: ['KICK_MEMBERS', 'KICK_MEMBERS'],
      }).success,
    ).toBe(false);
  });

  it('limits timeouts to 28 days and permits clearing them', () => {
    expect(timeoutMemberSchema.safeParse({ durationMinutes: 40_321 }).success).toBe(false);
    expect(timeoutMemberSchema.parse({ durationMinutes: null })).toEqual({
      durationMinutes: null,
    });
  });

  it('exposes the expanded balanced permission set and everyone role marker', () => {
    expect(serverPermissionSchema.options).toContain('VIEW_AUDIT_LOG');
    expect(serverPermissionSchema.options).toContain('SHARE_SCREEN');
    expect(serverPermissionSchema.options).toContain('MENTION_EVERYONE');
    expect(
      customServerRoleSchema.parse({
        id: '018f0d7a-91ab-7abc-8def-0123456789ab',
        name: '@everyone',
        color: '#94A3B8',
        hoist: false,
        mentionable: false,
        isEveryone: true,
        position: 0,
        permissions: ['VIEW_CHANNEL'],
        memberCount: 2,
      }).isEveryone,
    ).toBe(true);
  });

  it('validates safe AutoMod, ban deletion and audit pagination inputs', () => {
    const autoMod = autoModConfigSchema.parse({
      enabled: true,
      bannedWords: [],
      bannedWordsEnabled: false,
      bannedWordsAction: 'DELETE_MESSAGE',
      regexEnabled: true,
      regexPatterns: ['\\btest\\d+\\b'],
      regexAction: 'WARN_USER',
      linkProtection: true,
      linkProtectionAction: 'WARN_USER',
      allowedDomains: ['wapve.com'],
      spamProtection: true,
      spamMaxMessages: 5,
      spamInterval: 10,
      spamAction: 'TIMEOUT_5M',
      repeatedMessageProtection: true,
      repeatedMessageMax: 3,
      repeatedMessageInterval: 30,
      repeatedMessageAction: 'DELETE_MESSAGE',
      mentionSpamProtection: true,
      mentionMaxCount: 5,
      mentionAction: 'WARN_USER',
      capsProtection: false,
      capsMinLength: 10,
      capsPercentage: 70,
      capsAction: 'DELETE_MESSAGE',
      emojiSpamProtection: false,
      emojiMaxCount: 15,
      emojiAction: 'DELETE_MESSAGE',
      exemptRoles: [],
      exemptChannels: [],
      logChannelId: null,
    });
    expect(autoMod.allowedDomains).toEqual(['wapve.com']);
    expect(autoMod.regexPatterns).toEqual(['\\btest\\d+\\b']);
    expect(() => autoModConfigSchema.parse({ ...autoMod, regexPatterns: ['(a+)+'] })).toThrow();
    expect(banMemberSchema.parse({ deleteMessageSeconds: '604800' }).deleteMessageSeconds).toBe(
      '604800',
    );
    expect(auditLogQuerySchema.parse({ limit: '50', action: 'SERVER_ROLE' }).limit).toBe(50);
  });
});
