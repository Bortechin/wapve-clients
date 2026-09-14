import type { ServerLayoutItem } from '@wapve/contracts';

export type ServerLayoutDropPlacement = 'before' | 'inside' | 'after';

function withoutServer(
  layout: ServerLayoutItem[],
  serverId: string,
  preserveFolderId?: string,
): ServerLayoutItem[] {
  return layout
    .filter((item) => item.type !== 'server' || item.id !== serverId)
    .map((item) =>
      item.type === 'folder'
        ? { ...item, serverIds: (item.serverIds ?? []).filter((id) => id !== serverId) }
        : item,
    )
    .filter(
      (item) =>
        item.type !== 'folder' || item.id === preserveFolderId || Boolean(item.serverIds?.length),
    );
}

export function moveServerInLayout(
  layout: ServerLayoutItem[],
  serverId: string,
  targetId: string,
): ServerLayoutItem[] {
  if (serverId === targetId) return layout;
  const targetFolder = layout.find(
    (item) => item.type === 'folder' && item.serverIds?.includes(targetId),
  );
  const directTarget = layout.find((item) => item.id === targetId);
  const preservedFolderId = directTarget?.type === 'folder' ? directTarget.id : targetFolder?.id;
  const next = withoutServer(layout, serverId, preservedFolderId);

  if (directTarget?.type === 'folder') {
    return next.map((item) =>
      item.id === directTarget.id
        ? { ...item, serverIds: [...(item.serverIds ?? []), serverId] }
        : item,
    );
  }

  if (targetFolder) {
    return next.map((item) => {
      if (item.id !== targetFolder.id) return item;
      const serverIds = [...(item.serverIds ?? [])];
      const targetIndex = serverIds.indexOf(targetId);
      serverIds.splice(targetIndex < 0 ? serverIds.length : targetIndex, 0, serverId);
      return { ...item, serverIds };
    });
  }

  const targetIndex = next.findIndex((item) => item.type === 'server' && item.id === targetId);
  if (targetIndex >= 0) {
    next.splice(targetIndex, 1, {
      type: 'folder',
      id: `folder-${crypto.randomUUID()}`,
      color: '#1478ff',
      serverIds: [targetId, serverId],
    });
    return next;
  }

  next.push({ type: 'server', id: serverId });
  return next;
}

export function moveFolderInLayout(
  layout: ServerLayoutItem[],
  folderId: string,
  targetId: string,
): ServerLayoutItem[] {
  const folder = layout.find((item) => item.type === 'folder' && item.id === folderId);
  if (!folder || folder.id === targetId || folder.serverIds?.includes(targetId)) return layout;
  const targetContainer = layout.find(
    (item) =>
      item.id === targetId || (item.type === 'folder' && item.serverIds?.includes(targetId)),
  );
  if (!targetContainer) return layout;
  const next = layout.filter((item) => item.id !== folderId);
  const targetIndex = next.findIndex((item) => item.id === targetContainer.id);
  next.splice(targetIndex < 0 ? next.length : targetIndex, 0, folder);
  return next;
}

export function dropServerInLayout(
  layout: ServerLayoutItem[],
  serverId: string,
  targetId: string,
  placement: ServerLayoutDropPlacement,
): ServerLayoutItem[] {
  if (serverId === targetId) return layout;
  if (placement === 'inside') return moveServerInLayout(layout, serverId, targetId);

  const targetFolder = layout.find(
    (item) => item.type === 'folder' && item.serverIds?.includes(targetId),
  );
  if (targetFolder) {
    const next = withoutServer(layout, serverId, targetFolder.id);
    return next.map((item) => {
      if (item.id !== targetFolder.id) return item;
      const serverIds = [...(item.serverIds ?? [])];
      const targetIndex = serverIds.indexOf(targetId);
      serverIds.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, serverId);
      return { ...item, serverIds };
    });
  }

  const next = withoutServer(layout, serverId);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return [...next, { type: 'server', id: serverId }];
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, {
    type: 'server',
    id: serverId,
  });
  return next;
}

export function dropFolderInLayout(
  layout: ServerLayoutItem[],
  folderId: string,
  targetId: string,
  placement: Exclude<ServerLayoutDropPlacement, 'inside'>,
): ServerLayoutItem[] {
  const folder = layout.find((item) => item.type === 'folder' && item.id === folderId);
  if (!folder || folder.id === targetId || folder.serverIds?.includes(targetId)) return layout;
  const targetContainer = layout.find(
    (item) =>
      item.id === targetId || (item.type === 'folder' && item.serverIds?.includes(targetId)),
  );
  if (!targetContainer) return layout;
  const next = layout.filter((item) => item.id !== folderId);
  const targetIndex = next.findIndex((item) => item.id === targetContainer.id);
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, folder);
  return next;
}

export function extractServerFromFolder(
  layout: ServerLayoutItem[],
  serverId: string,
): ServerLayoutItem[] {
  const sourceIndex = layout.findIndex(
    (item) => item.type === 'folder' && item.serverIds?.includes(serverId),
  );
  if (sourceIndex < 0) return layout;
  const sourceFolderId = layout[sourceIndex]?.id;
  const next = withoutServer(layout, serverId);
  const sourceFolderStillExists = next.some((item) => item.id === sourceFolderId);
  next.splice(sourceIndex + (sourceFolderStillExists ? 1 : 0), 0, {
    type: 'server',
    id: serverId,
  });
  return next;
}
