import { describe, expect, it } from '@jest/globals';
import { categoryOrderFromRows, channelOrderFromRows, type ChannelLayoutRow } from './channel-layout';

const rows: ChannelLayoutRow[] = [
  { kind: 'category', id: 'category:a', category: { id: 'a' } },
  { kind: 'channel', id: 'channel:one', channel: { id: 'one' } },
  { kind: 'category', id: 'category:b', category: { id: 'b' } },
  { kind: 'channel', id: 'channel:two', channel: { id: 'two' } },
  { kind: 'channel', id: 'channel:three', channel: { id: 'three' } },
  { kind: 'category', id: 'category:uncategorized', category: null },
  { kind: 'channel', id: 'channel:loose', channel: { id: 'loose' } },
];

describe('cross-category channel layout', () => {
  it('assigns every channel to the category header above it with independent positions', () => {
    expect(channelOrderFromRows(rows)).toEqual([
      { id: 'one', categoryId: 'a', position: 0 },
      { id: 'two', categoryId: 'b', position: 0 },
      { id: 'three', categoryId: 'b', position: 1 },
      { id: 'loose', categoryId: null, position: 0 },
    ]);
  });

  it('does not send the synthetic uncategorized header to category reorder', () => {
    expect(categoryOrderFromRows(rows)).toEqual(['a', 'b']);
  });
});
