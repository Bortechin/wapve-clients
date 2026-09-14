import { describe, expect, it } from 'vitest';
import {
  channelNameSchema,
  channelTopicSchema,
  createChannelSchema,
  reorderChannelsSchema,
  serverChannelSchema,
  updateChannelSchema,
  updateChannelPermissionsSchema,
} from './channel.js';

describe('channel contracts', () => {
  it('accepts safe Unicode channel names and trims whitespace', () => {
    expect(channelNameSchema.parse('  Genel Sohbet  ')).toBe('Genel Sohbet');
    expect(channelNameSchema.parse('oyun-dünyası')).toBe('oyun-dünyası');
  });

  it('rejects control and directional override characters', () => {
    expect(() => channelNameSchema.parse('genel\u0000')).toThrow();
    expect(() => channelNameSchema.parse('genel\u202Etxt')).toThrow();
  });

  it('limits channel names to 50 and formatted topics to 500 characters', () => {
    expect(channelNameSchema.parse(`🎮-${'a'.repeat(47)}`)).toBe(`🎮-${'a'.repeat(47)}`);
    expect(() => channelNameSchema.parse('a'.repeat(51))).toThrow();
    expect(channelTopicSchema.parse('**Kalın** ve __altı çizili__ 🎉')).toContain('**Kalın**');
    expect(() => channelTopicSchema.parse('a'.repeat(501))).toThrow();
    expect(() => channelTopicSchema.parse('başlık\u202E')).toThrow();
  });

  it('requires a real channel update', () => {
    expect(() => updateChannelSchema.parse({})).toThrow();
    expect(updateChannelSchema.parse({ topic: null })).toEqual({ topic: null });
  });

  it('bounds voice channel limits and bitrate', () => {
    expect(updateChannelSchema.parse({ userLimit: 50, bitrateKbps: 384 })).toEqual({
      userLimit: 50,
      bitrateKbps: 384,
    });
    expect(() => updateChannelSchema.parse({ userLimit: 51 })).toThrow();
    expect(() => updateChannelSchema.parse({ bitrateKbps: 7 })).toThrow();
    expect(() => updateChannelSchema.parse({ bitrateKbps: 385 })).toThrow();
  });

  it('rejects duplicate channel ids in a reorder batch', () => {
    const id = '018f0d7a-91ab-7abc-8def-0123456789ab';
    expect(() =>
      reorderChannelsSchema.parse({
        items: [
          { id, categoryId: null, position: 0 },
          { id, categoryId: null, position: 1 },
        ],
      }),
    ).toThrow();
  });

  it('keeps category selection out of the creation contract', () => {
    expect(
      createChannelSchema.parse({ name: 'genel', type: 'TEXT', categoryId: 'ignored' }),
    ).toEqual({ name: 'genel', type: 'TEXT', nsfw: false });
  });

  it('requires 18-digit channel ids beginning with 18', () => {
    const base = {
      id: '018f0d7a-91ab-7abc-8def-0123456789ab',
      publicId: '180123456789012345',
      serverId: '018f0d7a-91ab-7abc-8def-0123456789ac',
      categoryId: null,
      name: 'genel',
      topic: null,
      slowModeSeconds: 0,
      nsfw: false,
      userLimit: 0,
      bitrateKbps: 64,
      type: 'TEXT',
      position: 0,
      permissions: {
        VIEW_CHANNEL: true,
        MANAGE_CHANNELS: false,
        SEND_MESSAGES: true,
        ATTACH_FILES: true,
        USE_GIFS: true,
        ADD_REACTIONS: true,
        CREATE_POLLS: true,
        CONNECT: false,
        SPEAK: false,
        USE_CAMERA: false,
        SHARE_SCREEN: false,
      },
      memberPermissions: null,
    };
    expect(serverChannelSchema.safeParse(base).success).toBe(true);
    expect(serverChannelSchema.safeParse({ ...base, publicId: '100000000000001' }).success).toBe(
      false,
    );
  });

  it('accepts unique three-state role and user permission targets', () => {
    const permissions = {
      VIEW_CHANNEL: 'DENY',
      MANAGE_CHANNELS: 'INHERIT',
      SEND_MESSAGES: 'ALLOW',
      ATTACH_FILES: 'INHERIT',
      USE_GIFS: 'INHERIT',
      ADD_REACTIONS: 'INHERIT',
      CREATE_POLLS: 'INHERIT',
      CONNECT: 'INHERIT',
      SPEAK: 'INHERIT',
      USE_CAMERA: 'INHERIT',
      SHARE_SCREEN: 'INHERIT',
    } as const;
    expect(
      updateChannelPermissionsSchema.parse({
        targets: [
          { target: { type: 'EVERYONE' }, permissions },
          {
            target: { type: 'ROLE', roleId: '018f0d7a-91ab-7abc-8def-0123456789ab' },
            permissions,
          },
        ],
      }).targets,
    ).toHaveLength(2);
    const userTarget = {
      target: { type: 'USER' as const, userId: '018f0d7a-91ab-7abc-8def-0123456789ab' },
      permissions,
    };
    expect(updateChannelPermissionsSchema.parse({ targets: [userTarget] }).targets).toHaveLength(1);
    expect(() =>
      updateChannelPermissionsSchema.parse({ targets: [userTarget, userTarget] }),
    ).toThrow();
  });
});
