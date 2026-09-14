import { describe, expect, it } from '@jest/globals';
import {
  acceptMobileUploadCandidates,
  formatUploadBytes,
  MAX_MOBILE_ATTACHMENT_BYTES,
} from './mobile-upload-queue';

const base = { uri: 'content://one', name: 'one.jpg', mimeType: 'image/jpeg', size: 1024 };

describe('mobile upload queue', () => {
  it('rejects duplicate, oversized, and overflow selections without losing valid files', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({ ...base, uri: `content://existing-${index}` }));
    const result = acceptMobileUploadCandidates(existing, [
      existing[0]!,
      { ...base, uri: 'content://large', name: 'large.mp4', size: MAX_MOBILE_ATTACHMENT_BYTES + 1 },
      { ...base, uri: 'content://valid-1' },
      { ...base, uri: 'content://valid-2' },
      { ...base, uri: 'content://overflow' },
    ]);

    expect(result.accepted.map((item) => item.uri)).toEqual(['content://valid-1', 'content://valid-2']);
    expect(result.rejected.map((item) => item.reason)).toEqual(['duplicate', 'too-large', 'queue-full']);
  });

  it('formats compact file sizes', () => {
    expect(formatUploadBytes(900)).toBe('900 B');
    expect(formatUploadBytes(2048)).toBe('2 KB');
    expect(formatUploadBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
