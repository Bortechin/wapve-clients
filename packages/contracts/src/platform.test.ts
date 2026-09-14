import { describe, expect, it } from 'vitest';
import {
  createUserReportSchema,
  ownerBadgeAssignmentSchema,
  ownerSanctionSchema,
  ownerUnlockSchema,
} from './platform.js';

describe('platform contracts', () => {
  it('requires a meaningful report and rejects arbitrary diagnostics', () => {
    expect(
      createUserReportSchema.safeParse({
        category: 'BUG',
        title: 'Message composer',
        description: 'The send button does not react after attaching a file.',
        context: { secret: 'must not pass' },
      }).success,
    ).toBe(false);
  });

  it('accepts only credential-free HTTP(S) report links', () => {
    const report = {
      category: 'BUG',
      title: 'Message composer',
      description: 'The send button does not react after attaching a file.',
    };
    expect(
      createUserReportSchema.safeParse({ ...report, pageUrl: 'https://wapve.com/app' }).success,
    ).toBe(true);
    expect(
      createUserReportSchema.safeParse({ ...report, pageUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      createUserReportSchema.safeParse({ ...report, pageUrl: 'https://user:pass@wapve.com/' })
        .success,
    ).toBe(false);
  });

  it('supports explicit indefinite sanctions', () => {
    expect(
      ownerSanctionSchema.parse({ reason: 'Repeated abuse', durationMinutes: null }),
    ).toMatchObject({ durationMinutes: null });
  });

  it('requires both the owner password and a second factor', () => {
    expect(ownerUnlockSchema.safeParse({ currentPassword: 'valid but no code' }).success).toBe(
      false,
    );
  });

  it('keeps the dynamic server-surfer badge out of manual badge assignment', () => {
    expect(
      ownerBadgeAssignmentSchema.safeParse({ badge: 'SERVER_SURFER', enabled: true }).success,
    ).toBe(false);
  });
});
