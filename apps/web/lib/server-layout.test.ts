import type { ServerLayoutItem } from '@wapve/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  dropFolderInLayout,
  dropServerInLayout,
  extractServerFromFolder,
  moveFolderInLayout,
  moveServerInLayout,
} from './server-layout';

const layout: ServerLayoutItem[] = [
  { type: 'server', id: 'a' },
  { type: 'folder', id: 'folder-one', name: 'Oyun', serverIds: ['b', 'c', 'd'] },
  { type: 'server', id: 'e' },
];

describe('server layout drag and drop', () => {
  it('reorders a server inside a folder without extracting it', () => {
    expect(moveServerInLayout(layout, 'd', 'b')[1]).toMatchObject({
      id: 'folder-one',
      serverIds: ['d', 'b', 'c'],
    });
  });

  it('moves an outside server into a folder and keeps its metadata', () => {
    expect(moveServerInLayout(layout, 'a', 'folder-one')).toEqual([
      { type: 'folder', id: 'folder-one', name: 'Oyun', serverIds: ['b', 'c', 'd', 'a'] },
      { type: 'server', id: 'e' },
    ]);
  });

  it('extracts a server immediately after its source folder', () => {
    expect(extractServerFromFolder(layout, 'c')).toEqual([
      { type: 'server', id: 'a' },
      { type: 'folder', id: 'folder-one', name: 'Oyun', serverIds: ['b', 'd'] },
      { type: 'server', id: 'c' },
      { type: 'server', id: 'e' },
    ]);
  });

  it('reorders the complete folder as one rail item', () => {
    expect(moveFolderInLayout(layout, 'folder-one', 'a').map((item) => item.id)).toEqual([
      'folder-one',
      'a',
      'e',
    ]);
  });

  it('creates a colored folder when one standalone server is dropped on another', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'folder-id' });
    expect(moveServerInLayout(layout, 'e', 'a')[0]).toEqual({
      type: 'folder',
      id: 'folder-folder-id',
      color: '#1478ff',
      serverIds: ['a', 'e'],
    });
    vi.unstubAllGlobals();
  });

  it('reorders standalone servers without creating a folder at the edge drop zones', () => {
    expect(dropServerInLayout(layout, 'e', 'a', 'before').map((item) => item.id)).toEqual([
      'e',
      'a',
      'folder-one',
    ]);
  });

  it('reorders servers inside a folder using before and after placement', () => {
    expect(dropServerInLayout(layout, 'd', 'b', 'after')[1]).toMatchObject({
      serverIds: ['b', 'd', 'c'],
    });
  });

  it('moves a folder after another top-level item', () => {
    expect(dropFolderInLayout(layout, 'folder-one', 'e', 'after').map((item) => item.id)).toEqual([
      'a',
      'e',
      'folder-one',
    ]);
  });
});
