import { describe, expect, it } from 'vitest';
import {
  incrementReactionFrequency,
  quickReactions,
  readReactionFrequency,
} from './reaction-frequency';

describe('reaction frequency', () => {
  it('uses learned reactions first and fills the remaining defaults', () => {
    expect(quickReactions({ '🔥': 4, '😂': 2 }, [])).toEqual(['🔥', '😂', '👍']);
  });

  it('hides a learned custom emoji when it is unavailable in this server', () => {
    const custom = '<:asd:019c0000-0000-7000-8000-000000000001>';
    expect(quickReactions({ [custom]: 8 }, [])).not.toContain(custom);
    expect(quickReactions({ [custom]: 8 }, [custom])[0]).toBe(custom);
  });

  it('reads only positive integer counts and increments safely', () => {
    expect(readReactionFrequency('{"👍":2,"bad":-1,"half":1.5}')).toEqual({ '👍': 2 });
    expect(incrementReactionFrequency({ '👍': 2 }, '👍')).toEqual({ '👍': 3 });
    expect(readReactionFrequency('not-json')).toEqual({});
  });
});
