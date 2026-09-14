import { describe, expect, it } from 'vitest';
import { globalMessageSearchPageSchema, globalMessageSearchQuerySchema } from './search.js';

describe('global message search contracts', () => {
  it('requires a useful term and caps page size', () => {
    expect(globalMessageSearchQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(globalMessageSearchQuerySchema.safeParse({ q: 'selam', limit: 51 }).success).toBe(false);
    expect(globalMessageSearchQuerySchema.parse({ q: ' selam ' }).limit).toBe(30);
  });

  it('accepts a cursor page containing mixed message targets', () => {
    expect(globalMessageSearchPageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });
});
