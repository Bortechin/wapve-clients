import { describe, expect, it } from 'vitest';
import { parseLastTextChannels } from './last-text-channel';

describe('last text channel storage', () => {
  it('keeps valid server-to-channel entries', () => {
    expect(
      parseLastTextChannels(
        JSON.stringify({ '123456789012345': '180123456789012345', invalid: 42 }),
      ),
    ).toEqual({ '123456789012345': '180123456789012345' });
  });

  it('ignores malformed storage', () => {
    expect(parseLastTextChannels('{')).toEqual({});
    expect(parseLastTextChannels('[]')).toEqual({});
  });
});
