import { describe, expect, it } from 'vitest';
import {
  createServerInviteSchema,
  deleteServerSchema,
  joinServerSchema,
  serverDescriptionSchema,
  serverInsightsQuerySchema,
  serverMemberSchema,
  serverNameSchema,
  serverInviteUrl,
  configureServerTagSchema,
  serverTagPreviewSchema,
  selectServerTagSchema,
} from './server.js';

describe('server contracts', () => {
  it('accepts trimmed Unicode server names', () => {
    expect(serverNameSchema.parse('  Mavi Dalgalar  ')).toBe('Mavi Dalgalar');
  });

  it('accepts harmless punctuation but rejects hidden controls in descriptions', () => {
    expect(serverDescriptionSchema.parse("Topluluk ' OR 1=1 --")).toBe("Topluluk ' OR 1=1 --");
    expect(serverDescriptionSchema.safeParse('Güvenli\u202Edeğil').success).toBe(false);
    expect(serverDescriptionSchema.safeParse('x'.repeat(301)).success).toBe(false);
  });

  it('accepts only bounded Base64URL invite codes or links containing one', () => {
    expect(joinServerSchema.parse({ code: 'https://wapve.com/invite/Abc_123-Xy' }).code).toContain('Abc_123-Xy');
    expect(joinServerSchema.parse({ code: 'https://wapve.cc/Abc_123-Xy' }).code).toContain('Abc_123-Xy');
    expect(joinServerSchema.parse({ code: 'https://wapve.cc/wapve' }).code).toContain('wapve');
    expect(serverInviteUrl('Abc_123-Xy')).toBe('https://wapve.cc/Abc_123-Xy');
    expect(joinServerSchema.safeParse({ code: "' OR 1=1 --" }).success).toBe(false);
    expect(
      joinServerSchema.safeParse({ code: 'https://user:pass@wapve.com/invite/Abc12345' }).success,
    ).toBe(false);
    expect(joinServerSchema.safeParse({ code: 'https://evil.example/Abc12345' }).success).toBe(false);
    expect(joinServerSchema.safeParse({ code: 'https://wapve.cc/Abc12345?next=evil' }).success).toBe(false);
    expect(joinServerSchema.safeParse({ code: 'https://wapve.cc//Abc12345' }).success).toBe(false);
  });

  it('requires a current password for server deletion', () => {
    expect(deleteServerSchema.safeParse({ currentPassword: '' }).success).toBe(false);
    expect(
      deleteServerSchema.safeParse({ currentPassword: 'correct horse battery staple' }).success,
    ).toBe(true);
  });

  it('rejects control and directional override characters', () => {
    expect(serverNameSchema.safeParse('Wapve\nAdmin').success).toBe(false);
    expect(serverNameSchema.safeParse('Wapve\u202EAdmin').success).toBe(false);
  });

  it('bounds and defaults invite settings', () => {
    expect(createServerInviteSchema.parse({})).toEqual({ maxUses: 1, expiresInHours: 24 });
    expect(
      createServerInviteSchema.safeParse({ maxUses: 1_000_001, expiresInHours: 24 }).success,
    ).toBe(false);
  });

  it('requires an 11-digit public member id', () => {
    const member = {
      id: '018f0d7a-91ab-7abc-8def-0123456789ab',
      publicId: '12345678901',
      username: 'dalga',
      displayName: 'Dalga',
      avatarUrl: null,
      status: 'ONLINE',
      role: 'MEMBER',
      premium: {
        active: true,
        avatarDecoration: null,
        profileEffect: null,
        nameplate: 'CRESCENT_TIDE',
      },
      roles: [],
      timeoutUntil: null,
      timeoutReason: null,
      joinedAt: '2026-08-20T00:00:00.000Z',
    };
    expect(serverMemberSchema.parse(member).publicId).toBe('12345678901');
    expect(serverMemberSchema.parse(member).premium?.nameplate).toBe('CRESCENT_TIDE');
    expect(serverMemberSchema.safeParse({ ...member, publicId: '123' }).success).toBe(false);
  });

  it('accepts only the bounded insights ranges and defaults to 7 days', () => {
    expect(serverInsightsQuerySchema.parse({}).days).toBe(7);
    expect(serverInsightsQuerySchema.parse({ days: '14' }).days).toBe(14);
    expect(serverInsightsQuerySchema.parse({ days: 30 }).days).toBe(30);
    expect(serverInsightsQuerySchema.safeParse({ days: 15 }).success).toBe(false);
  });

  it('normalizes a server tag and rejects unsafe or overlong codes', () => {
    expect(
      configureServerTagSchema.parse({ code: 'wave', badge: 'WAVE', color: '#38bdf8' }),
    ).toEqual({ code: 'WAVE', badge: 'WAVE', color: '#38BDF8' });
    expect(
      configureServerTagSchema.safeParse({ code: 'WAVES', badge: 'STAR', color: '#ffffff' })
        .success,
    ).toBe(false);
    expect(
      configureServerTagSchema.safeParse({ code: '<b>', badge: 'STAR', color: '#ffffff' }).success,
    ).toBe(false);
    expect(selectServerTagSchema.parse({ enabled: true })).toEqual({ enabled: true });
  });

  it('validates the anchored server-tag invitation preview', () => {
    expect(
      serverTagPreviewSchema.parse({
        serverId: '018f0d7a-91ab-7abc-8def-0123456789ab',
        publicId: '100000000000001',
        name: 'Wapve Resmî',
        iconUrl: null,
        bannerUrl: null,
        description: 'Resmî topluluk',
        memberCount: 12,
        onlineCount: 4,
        createdAt: '2026-08-31T00:00:00.000Z',
        alreadyMember: false,
      }).onlineCount,
    ).toBe(4);
  });
});
