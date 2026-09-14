import { describe, expect, it } from 'vitest';
import { uploadServerSoundQuerySchema } from './soundboard.js';

describe('uploadServerSoundQuerySchema', () => {
  it('accepts a selected clip up to six seconds', () => {
    expect(
      uploadServerSoundQuerySchema.parse({
        name: 'Airhorn',
        emoji: '📣',
        volume: '100',
        clipStartMs: '1234',
        clipDurationMs: '6000',
      }),
    ).toMatchObject({ clipStartMs: 1234, clipDurationMs: 6000 });
  });

  it('rejects clips longer than six seconds', () => {
    expect(
      uploadServerSoundQuerySchema.safeParse({
        name: 'Too long',
        clipDurationMs: '6001',
      }).success,
    ).toBe(false);
  });
});
