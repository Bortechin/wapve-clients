import type { ServerLayoutItem } from '@wapve/contracts';

export type ServerLayoutDropPlacement = 'before' | 'inside' | 'after';

function withoutServer(layout: ServerLayoutItem[], serverId: string, preserveFolderId?: string) {
  return layout
    .filter((item) => item.type !== 'server' || item.id !== serverId)
    .map((item) => item.type === 'folder'
      ? { ...item, serverIds: (item.serverIds ?? []).filter((id) => id !== serverId) }
      : item)
    .filter((item) => item.type !== 'folder' || item.id === preserveFolderId || Boolean(item.serverIds?.length));
}

export function normalizeServerLayout(layout: ServerLayoutItem[] | null | undefined, serverIds: string[]) {
  const available = new Set(serverIds);
  const seen = new Set<string>();
  const normalized: ServerLayoutItem[] = [];
  for (const item of layout ?? []) {
    if (item.type === 'server') {
      if (available.has(item.id) && !seen.has(item.id)) {
        normalized.push({ type: 'server', id: item.id });
        seen.add(item.id);
      }
      continue;
    }
    const ids = (item.serverIds ?? []).filter((id) => available.has(id) && !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (ids.length) normalized.push({ ...item, serverIds: ids });
  }
  for (const id of serverIds) if (!seen.has(id)) normalized.push({ type: 'server', id });
  return normalized;
}

export function moveServer(layout: ServerLayoutItem[], serverId: string, direction: -1 | 1) {
  const next = layout.map((item) => item.serverIds ? { ...item, serverIds: [...item.serverIds] } : { ...item });
  const folderIndex = next.findIndex((item) => item.type === 'folder' && item.serverIds?.includes(serverId));
  if (folderIndex >= 0) {
    const folder = next[folderIndex];
    if (!folder) return next;
    const ids = folder.serverIds ?? [];
    const index = ids.indexOf(serverId);
    const target = index + direction;
    if (target >= 0 && target < ids.length) {
      const current = ids[index];
      const replacement = ids[target];
      if (current !== undefined && replacement !== undefined) {
        ids[index] = replacement;
        ids[target] = current;
      }
    }
    return next;
  }
  const index = next.findIndex((item) => item.type === 'server' && item.id === serverId);
  const target = index + direction;
  if (index >= 0 && target >= 0 && target < next.length) {
    const current = next[index];
    const replacement = next[target];
    if (current && replacement) {
      next[index] = replacement;
      next[target] = current;
    }
  }
  return next;
}

export function createFolder(layout: ServerLayoutItem[], serverId: string, targetId: string) {
  if (serverId === targetId) return layout;
  const stripped = layout
    .filter((item) => item.type !== 'server' || (item.id !== serverId && item.id !== targetId))
    .map((item) => item.type === 'folder' ? { ...item, serverIds: (item.serverIds ?? []).filter((id) => id !== serverId && id !== targetId) } : item)
    .filter((item) => item.type !== 'folder' || Boolean(item.serverIds?.length));
  const targetIndex = Math.max(0, layout.findIndex((item) => item.id === targetId));
  stripped.splice(Math.min(targetIndex, stripped.length), 0, {
    type: 'folder',
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Yeni klasör',
    color: '#1478ff',
    expanded: true,
    serverIds: [targetId, serverId],
  });
  return stripped;
}

export function extractServer(layout: ServerLayoutItem[], serverId: string) {
  const folderIndex = layout.findIndex((item) => item.type === 'folder' && item.serverIds?.includes(serverId));
  if (folderIndex < 0) return layout;
  const next = layout.map((item) => item.type === 'folder' ? { ...item, serverIds: (item.serverIds ?? []).filter((id) => id !== serverId) } : item).filter((item) => item.type !== 'folder' || Boolean(item.serverIds?.length));
  next.splice(Math.min(folderIndex + 1, next.length), 0, { type: 'server', id: serverId });
  return next;
}

export function dropServerInLayout(
  layout: ServerLayoutItem[],
  serverId: string,
  targetId: string,
  placement: ServerLayoutDropPlacement,
) {
  if (serverId === targetId) return layout;
  const directTarget = layout.find((item) => item.id === targetId);
  const targetFolder = layout.find((item) => item.type === 'folder' && item.serverIds?.includes(targetId));

  if (placement === 'inside') {
    const preserveFolderId = directTarget?.type === 'folder' ? directTarget.id : targetFolder?.id;
    const next = withoutServer(layout, serverId, preserveFolderId);
    if (directTarget?.type === 'folder') {
      return next.map((item) => item.id === directTarget.id
        ? { ...item, expanded: true, serverIds: [...(item.serverIds ?? []), serverId] }
        : item);
    }
    if (targetFolder) {
      return next.map((item) => {
        if (item.id !== targetFolder.id) return item;
        const ids = [...(item.serverIds ?? [])];
        const index = ids.indexOf(targetId);
        ids.splice(index + 1, 0, serverId);
        return { ...item, expanded: true, serverIds: ids };
      });
    }
    const targetIndex = next.findIndex((item) => item.type === 'server' && item.id === targetId);
    if (targetIndex >= 0) {
      next.splice(targetIndex, 1, {
        type: 'folder',
        id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Yeni klasör',
        color: '#1478ff',
        expanded: true,
        serverIds: [targetId, serverId],
      });
    }
    return next;
  }

  if (targetFolder) {
    const next = withoutServer(layout, serverId, targetFolder.id);
    return next.map((item) => {
      if (item.id !== targetFolder.id) return item;
      const ids = [...(item.serverIds ?? [])];
      const targetIndex = ids.indexOf(targetId);
      ids.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, serverId);
      return { ...item, serverIds: ids };
    });
  }

  const next = withoutServer(layout, serverId);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return [...next, { type: 'server' as const, id: serverId }];
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, { type: 'server', id: serverId });
  return next;
}

export function dropFolderInLayout(
  layout: ServerLayoutItem[],
  folderId: string,
  targetId: string,
  placement: Exclude<ServerLayoutDropPlacement, 'inside'>,
) {
  const folder = layout.find((item) => item.type === 'folder' && item.id === folderId);
  if (!folder || folder.id === targetId || folder.serverIds?.includes(targetId)) return layout;
  const targetContainer = layout.find((item) => item.id === targetId || (item.type === 'folder' && item.serverIds?.includes(targetId)));
  if (!targetContainer) return layout;
  const next = layout.filter((item) => item.id !== folderId);
  const targetIndex = next.findIndex((item) => item.id === targetContainer.id);
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, folder);
  return next;
}
