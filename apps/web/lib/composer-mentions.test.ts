import { describe, expect, it } from 'vitest';
import {
  buildComposerMentionAliases,
  canonicalizeComposerMentions,
  displayComposerMentions,
  displayOffsetFromRaw,
  rawOffsetFromDisplay,
} from './composer-mentions';

const aliases = buildComposerMentionAliases(
  [{ id: 'member-uuid', publicId: '83398948397', displayName: 'LalaŞahinPaşa' }],
  [{ id: 'role-uuid', name: 'Yönetici' }],
  [
    { id: 'channel-uuid', publicId: '93898948397', name: 'genel-sohbet', type: 'TEXT' },
    { id: 'voice-uuid', publicId: '94898948397', name: 'Sohbet Odası', type: 'VOICE' },
  ],
);

describe('composer mention aliases', () => {
  it('shows public member and channel ids as readable mentions', () => {
    expect(displayComposerMentions('Selam <@83398948397> <#93898948397>', aliases)).toBe(
      'Selam @LalaŞahinPaşa #genel-sohbet',
    );
  });

  it('keeps canonical ids in the submitted value', () => {
    expect(canonicalizeComposerMentions('@LalaŞahinPaşa #genel-sohbet', aliases)).toBe(
      '<@member-uuid> <#channel-uuid>',
    );
  });

  it('shows voice channels with headphones instead of a hash', () => {
    expect(displayComposerMentions('<#voice-uuid>', aliases)).toBe('🎧 Sohbet Odası');
    expect(canonicalizeComposerMentions('🎧 Sohbet Odası', aliases)).toBe('<#voice-uuid>');
  });

  it('maps caret offsets between readable and canonical forms', () => {
    const raw = 'x <@83398948397> y';
    const display = displayComposerMentions(raw, aliases);
    expect(rawOffsetFromDisplay(display, display.indexOf(' y'), aliases)).toBe(raw.indexOf(' y'));
    expect(displayOffsetFromRaw(raw, raw.indexOf(' y'), aliases)).toBe(display.indexOf(' y'));
  });
});
