import { describe, expect, it } from 'vitest';
import {
  createContentReportSchema,
  ownerContentReportUpdateSchema,
} from './content-report.js';

const targetId = '018f0d7a-91ab-7abc-8def-0123456789ab';

describe('content report contracts', () => {
  it('accepts a minimal channel message report', () => {
    expect(
      createContentReportSchema.parse({
        targetType: 'CHANNEL_MESSAGE',
        targetId,
        reason: 'SPAM',
      }),
    ).toMatchObject({ targetType: 'CHANNEL_MESSAGE', reason: 'SPAM' });
  });

  it('rejects unknown target types and reasons', () => {
    expect(
      createContentReportSchema.safeParse({ targetType: 'VOICE', targetId, reason: 'SPAM' })
        .success,
    ).toBe(false);
    expect(
      createContentReportSchema.safeParse({ targetType: 'USER', targetId, reason: 'MEAN' })
        .success,
    ).toBe(false);
  });

  it('rejects non-uuid targets and oversized descriptions', () => {
    expect(
      createContentReportSchema.safeParse({
        targetType: 'USER',
        targetId: 'not-a-uuid',
        reason: 'OTHER',
      }).success,
    ).toBe(false);
    expect(
      createContentReportSchema.safeParse({
        targetType: 'SERVER',
        targetId,
        reason: 'OTHER',
        description: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('bounds owner updates to the shared report statuses', () => {
    expect(
      ownerContentReportUpdateSchema.parse({ status: 'RESOLVED', ownerNote: null }),
    ).toMatchObject({ status: 'RESOLVED', ownerNote: null });
    expect(ownerContentReportUpdateSchema.safeParse({ status: 'SOMETHING' }).success).toBe(false);
    expect(
      ownerContentReportUpdateSchema.safeParse({ status: 'OPEN', ownerNote: 'x'.repeat(2001) })
        .success,
    ).toBe(false);
  });
});
