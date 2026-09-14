export type ChannelLayoutCategory = { id: string };
export type ChannelLayoutChannel = { id: string };
export type ChannelLayoutRow<C extends ChannelLayoutChannel = ChannelLayoutChannel, G extends ChannelLayoutCategory = ChannelLayoutCategory> =
  | { kind: 'category'; id: string; category: G | null }
  | { kind: 'channel'; id: string; channel: C };

export function categoryOrderFromRows(rows: ChannelLayoutRow[]) {
  return rows.flatMap((row) => row.kind === 'category' && row.category ? [row.category.id] : []);
}

export function channelOrderFromRows(rows: ChannelLayoutRow[]) {
  let categoryId: string | null = null;
  const positions = new Map<string | null, number>();
  const items: Array<{ id: string; categoryId: string | null; position: number }> = [];
  for (const row of rows) {
    if (row.kind === 'category') {
      categoryId = row.category?.id ?? null;
      continue;
    }
    const position = positions.get(categoryId) ?? 0;
    positions.set(categoryId, position + 1);
    items.push({ id: row.channel.id, categoryId, position });
  }
  return items;
}
