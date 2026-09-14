import type { DirectMessage } from '@wapve/contracts';
import { describe, expect, it } from '@jest/globals';
import { messagePreview, systemMessageLabel } from './message-presentation';

function message(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: '018f0d7a-91ab-7abc-8def-0123456789ab',
    conversationId: '018f0d7a-91ab-7abc-8def-0123456789ac',
    content: null,
    systemAction: null,
    systemDurationSeconds: null,
    deleted: false,
    editedAt: null,
    createdAt: '2026-08-25T12:00:00.000Z',
    author: {
      id: '018f0d7a-91ab-7abc-8def-0123456789ad',
      publicId: '12345678901',
      username: 'bortechin',
      displayName: 'Bortechin',
      avatarUrl: null,
      system: false,
      badges: [],
    },
    attachments: [],
    reactions: [],
    gif: null,
    replyTo: null,
    forwardedFrom: null,
    ...overrides,
  };
}

describe('mobile message presentation', () => {
  it('shows readable DM previews without revealing spoilers', () => {
    expect(messagePreview(message({ content: '🟢 **Bildirimin sonuçlandı**\n[Detay](https://wapve.com)' }))).toBe('🟢 Bildirimin sonuçlandı Detay');
    expect(messagePreview(message({ content: '||secret|| user_name' }))).toBe('••• user_name');
  });
  it('renders ended call system records instead of an empty bubble', () => {
    const value = message({ systemAction: 'CALL_ENDED', systemDurationSeconds: 125 });
    expect(systemMessageLabel(value)).toBe('Arama sona erdi · 2 dk 5 sn');
    expect(messagePreview(value)).toBe('Arama sona erdi · 2 dk 5 sn');
  });

  it('renders forwarded snapshots whose top-level content is null', () => {
    const value = message({
      forwardedFrom: {
        source: { kind: 'DIRECT', conversationId: message().conversationId, messageId: message().id },
        author: { id: message().author.id, username: 'sarih', displayName: 'Sarih', avatarUrl: null },
        contextName: 'Sarih',
        contextIconUrl: null,
        excerpt: 'İletilen asıl mesaj',
        createdAt: '2026-08-25T11:00:00.000Z',
      },
    });
    expect(messagePreview(value)).toBe('İletildi: İletilen asıl mesaj');
  });

  it('never returns an empty preview for an unknown payload', () => {
    expect(messagePreview(message())).toBe('Desteklenmeyen mesaj');
  });
});
