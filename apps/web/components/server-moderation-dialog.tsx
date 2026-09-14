'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@wapve/ui';
import type {
  AutoModAction,
  AutoModConfig,
  ChannelTree,
  ServerBan,
  ServerAuditPage,
  ServerAuditEvent,
  ServerMember,
  ServerPermission,
  ServerRole,
  ServerSummary,
} from '@wapve/contracts';
import {
  Ban,
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  GripVertical,
  LockKeyhole,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { TURKISH_PROFANITY_PRESET } from '@/lib/automod-presets';

const permissionGroups = [
  {
    key: 'general',
    permissions: ['MANAGE_SERVER', 'CREATE_INVITES', 'VIEW_AUDIT_LOG', 'MENTION_EVERYONE'],
  },
  {
    key: 'management',
    permissions: [
      'MANAGE_ROLES',
      'MANAGE_CHANNELS',
      'MANAGE_MESSAGES',
      'MANAGE_AUTOMOD',
      'MANAGE_EXPRESSIONS',
    ],
  },
  {
    key: 'moderation',
    permissions: ['KICK_MEMBERS', 'BAN_MEMBERS', 'TIMEOUT_MEMBERS'],
  },
  {
    key: 'text',
    permissions: [
      'VIEW_CHANNEL',
      'SEND_MESSAGES',
      'ATTACH_FILES',
      'USE_GIFS',
      'USE_EXTERNAL_EMOJIS',
      'ADD_REACTIONS',
      'CREATE_POLLS',
    ],
  },
  {
    key: 'voice',
    permissions: [
      'CONNECT',
      'SPEAK',
      'USE_SOUNDBOARD',
      'USE_EXTERNAL_SOUNDS',
      'USE_CAMERA',
      'SHARE_SCREEN',
    ],
  },
] as const satisfies ReadonlyArray<{
  key: keyof Dictionary['serverPermissionGroups'];
  permissions: ReadonlyArray<ServerPermission>;
}>;

export type ServerModerationSection = 'roles' | 'members' | 'bans' | 'automod' | 'audit';

type ModerationDialogState = {
  member: ServerMember;
  action: 'warn' | 'timeout' | 'kick' | 'ban';
};

function formString(data: FormData, key: string, fallback = ''): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function ServerModerationPanel({
  section,
  server,
  members,
  currentUserId,
  messages,
  onMembersChanged,
}: {
  section: ServerModerationSection;
  server: ServerSummary | null;
  members: ServerMember[];
  currentUserId: string;
  messages: Dictionary;
  onMembersChanged: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<ServerRole | null>(null);
  const [roleEditorTab, setRoleEditorTab] = useState<'appearance' | 'permissions' | 'members'>(
    'appearance',
  );
  const [armedAction, setArmedAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('ALL');
  const [memberRole, setMemberRole] = useState('ALL');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditActor, setAuditActor] = useState('');
  const [auditTarget, setAuditTarget] = useState('');
  const [moderationDialog, setModerationDialog] = useState<ModerationDialogState | null>(null);
  const [modMemberId, setModMemberId] = useState<string | null>(null);
  const [memberActions, setMemberActions] = useState<{
    member: ServerMember;
    left: number;
    top: number;
  } | null>(null);
  const serverId = server?.id;
  const roles = useQuery({
    queryKey: ['server-roles', serverId],
    queryFn: () => apiRequest<ServerRole[]>(`/servers/${serverId}/roles`),
    enabled: Boolean(serverId),
  });
  const bans = useQuery({
    queryKey: ['server-bans', serverId],
    queryFn: () => apiRequest<ServerBan[]>(`/servers/${serverId}/bans`),
    enabled: section === 'bans' && Boolean(serverId && server?.permissions.includes('BAN_MEMBERS')),
  });
  const audit = useQuery({
    queryKey: ['server-audit', serverId, auditAction, auditActor, auditTarget],
    queryFn: () => {
      const query = new URLSearchParams({ limit: '50' });
      if (auditAction) query.set('action', auditAction);
      if (auditActor) query.set('actorId', auditActor);
      if (auditTarget) query.set('targetId', auditTarget);
      return apiRequest<ServerAuditPage>(`/servers/${serverId}/audit-logs?${query}`);
    },
    enabled:
      section === 'audit' && Boolean(serverId && server?.permissions.includes('VIEW_AUDIT_LOG')),
  });
  const moderationHistory = useQuery({
    queryKey: ['moderation-history', serverId, moderationDialog?.member.id],
    queryFn: () =>
      apiRequest<ServerAuditEvent[]>(
        `/servers/${serverId}/members/${moderationDialog?.member.id}/moderation-history`,
      ),
    enabled: Boolean(serverId && moderationDialog?.member.id),
  });
  const modMemberHistory = useQuery({
    queryKey: ['moderation-history', serverId, modMemberId],
    queryFn: () =>
      apiRequest<ServerAuditEvent[]>(
        `/servers/${serverId}/members/${modMemberId}/moderation-history`,
      ),
    enabled: Boolean(serverId && modMemberId),
  });

  useEffect(() => {
    setEditingRole(null);
    setArmedAction('');
    setError('');
    setNotice('');
    setPermissionSearch('');
    setModMemberId(null);
    setMemberActions(null);
  }, [serverId]);

  useEffect(() => {
    if (!memberActions) return;
    const close = () => setMemberActions(null);
    const closeOnKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [memberActions]);

  if (!server) return null;
  const activeServer = server;
  const canManageRoles = activeServer.permissions.includes('MANAGE_ROLES');
  const actor = members.find((member) => member.id === currentUserId);
  const actorHighestRole = Math.max(-1, ...(actor?.roles.map((role) => role.position) ?? []));
  const canTarget = (member: ServerMember) =>
    member.role !== 'OWNER' &&
    member.id !== currentUserId &&
    (activeServer.role === 'OWNER' ||
      Math.max(-1, ...member.roles.map((role) => role.position)) < actorHighestRole);
  const assignableRoles =
    activeServer.role === 'OWNER'
      ? roles.data?.filter((role) => !role.isEveryone)
      : roles.data?.filter(
          (role) =>
            !role.isEveryone &&
            role.position < actorHighestRole &&
            role.permissions.every((permission) => activeServer.permissions.includes(permission)),
        );
  const visibleMembers = members.filter((member) => {
    const query = memberSearch.trim().toLocaleLowerCase();
    const matchesSearch =
      !query ||
      member.displayName.toLocaleLowerCase().includes(query) ||
      member.username.toLocaleLowerCase().includes(query);
    const matchesStatus = memberStatus === 'ALL' || member.status === memberStatus;
    const matchesRole = memberRole === 'ALL' || member.roles.some((role) => role.id === memberRole);
    return matchesSearch && matchesStatus && matchesRole;
  });
  const modMember = members.find((member) => member.id === modMemberId) ?? null;
  const normalizedPermissionSearch = permissionSearch.trim().toLocaleLowerCase();
  const permissionMatchesSearch = (permission: ServerPermission) =>
    !normalizedPermissionSearch ||
    messages.serverPermissions[permission]
      .toLocaleLowerCase()
      .includes(normalizedPermissionSearch) ||
    messages.serverPermissionDescriptions[permission]
      .toLocaleLowerCase()
      .includes(normalizedPermissionSearch);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setArmedAction('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['server-roles', activeServer.id] }),
        queryClient.invalidateQueries({ queryKey: ['server-bans', activeServer.id] }),
        queryClient.invalidateQueries({ queryKey: ['servers'] }),
        onMembersChanged(),
      ]);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openMemberActions(event: MouseEvent<HTMLButtonElement>, member: ServerMember) {
    event.stopPropagation();
    const width = 248;
    const height = 290;
    const rect = event.currentTarget.getBoundingClientRect();
    setMemberActions({
      member,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8)),
    });
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const permissions = data.getAll('permission');
    const hoist = data.get('hoist') === 'on';
    const mentionable = data.get('mentionable') === 'on';
    const succeeded = await run(
      () =>
        apiRequest(
          editingRole
            ? `/servers/${activeServer.id}/roles/${editingRole.id}`
            : `/servers/${activeServer.id}/roles`,
          {
            method: editingRole ? 'PATCH' : 'POST',
            body: JSON.stringify(
              editingRole?.isEveryone
                ? { permissions }
                : {
                    name: data.get('name'),
                    color: data.get('color'),
                    hoist,
                    mentionable,
                    permissions,
                  },
            ),
          },
        ),
      editingRole ? messages.roleUpdated : messages.roleCreated,
    );
    if (succeeded) {
      setEditingRole(null);
      form.reset();
    }
  }

  async function handleReorderRoles(draggedId: string, targetId: string) {
    if (draggedId === targetId || !roles.data) return;
    const currentRoles = roles.data.filter((role) => !role.isEveryone);
    const draggedIndex = currentRoles.findIndex((r) => r.id === draggedId);
    const targetIndex = currentRoles.findIndex((r) => r.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const item = currentRoles.splice(draggedIndex, 1)[0]!;
    currentRoles.splice(targetIndex, 0, item);

    const newItems = currentRoles.map((r, index) => ({
      id: r.id,
      position: currentRoles.length - index,
    }));

    await run(
      () =>
        apiRequest(`/servers/${activeServer.id}/roles`, {
          method: 'PATCH',
          body: JSON.stringify({ items: newItems }),
        }),
      'Roller başarıyla sıralandı.',
    );
  }

  async function confirm(actionKey: string, action: () => Promise<unknown>, success: string) {
    if (armedAction !== actionKey) {
      setArmedAction(actionKey);
      setNotice(messages.pressAgainToConfirm);
      return;
    }
    await run(action, success);
  }

  return (
    <div className="server-moderation-panel">
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}

      {section === 'roles' && (
        <div className="moderation-grid">
          <section className="moderation-list" aria-label={messages.roles}>
            <div className="role-list-header">
              <div>
                <strong>{messages.roles}</strong>
                <small>{roles.data?.length ?? 0}</small>
              </div>
              {canManageRoles && (
                <button
                  type="button"
                  className="role-create-button"
                  onClick={() => {
                    setEditingRole(null);
                    setRoleEditorTab('appearance');
                    setPermissionSearch('');
                  }}
                  aria-label={messages.createRole}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            {roles.data?.map((role) => (
              <button
                className={editingRole?.id === role.id ? 'active' : ''}
                key={role.id}
                draggable={canManageRoles && !role.isEveryone}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', role.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData('text/plain');
                  if (draggedId) {
                    void handleReorderRoles(draggedId, role.id);
                  }
                }}
                onClick={() => {
                  setEditingRole(role);
                  setRoleEditorTab('appearance');
                }}
              >
                {!role.isEveryone && <GripVertical className="role-drag-handle" size={15} />}
                <i style={{ background: role.color }} />
                <span>
                  <strong>{role.name}</strong>
                  <small>
                    {role.memberCount} {messages.member.toLowerCase()}
                  </small>
                </span>
                {canManageRoles && <Pencil size={14} />}
              </button>
            ))}
            {!roles.isPending && !roles.data?.length && <p>{messages.noRoles}</p>}
          </section>
          {canManageRoles && (
            <form
              className="role-editor form-stack"
              onSubmit={(event) => void saveRole(event)}
              key={editingRole?.id ?? 'new'}
            >
              <header className="role-editor-header">
                <span
                  className="role-editor-dot"
                  style={{ background: editingRole?.color ?? '#3978ff' }}
                />
                <div>
                  <span className="settings-eyebrow">{messages.roles}</span>
                  <h3>{editingRole ? editingRole.name : messages.createRole}</h3>
                </div>
              </header>
              <div className="role-editor-tabs" role="tablist" aria-label={messages.roles}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={roleEditorTab === 'appearance'}
                  onClick={() => setRoleEditorTab('appearance')}
                >
                  {messages.roleAppearance}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={roleEditorTab === 'permissions'}
                  onClick={() => setRoleEditorTab('permissions')}
                >
                  {messages.permissions}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={roleEditorTab === 'members'}
                  disabled={!editingRole || editingRole.isEveryone}
                  onClick={() => setRoleEditorTab('members')}
                >
                  {messages.manageMembers}
                </button>
              </div>
              <div className="role-appearance-panel" hidden={roleEditorTab !== 'appearance'}>
                <div className="role-preview-card">
                  <span className="role-preview-orbit" aria-hidden="true" />
                  <i style={{ background: editingRole?.color ?? '#3978ff' }} />
                  <div>
                    <small>{messages.roleAppearance}</small>
                    <strong style={{ color: editingRole?.color ?? '#eef2ff' }}>
                      {editingRole?.name || messages.createRole}
                    </strong>
                  </div>
                </div>
                <p className="role-panel-hint">{messages.roleAppearanceHint}</p>
                <div className="role-name-color">
                  <div className="field">
                    <label htmlFor="role-name">{messages.roleName}</label>
                    <input
                      id="role-name"
                      name="name"
                      required
                      minLength={1}
                      maxLength={32}
                      defaultValue={editingRole?.name ?? ''}
                      disabled={editingRole?.isEveryone}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="role-color">{messages.roleColor}</label>
                    <input
                      id="role-color"
                      type="color"
                      name="color"
                      defaultValue={editingRole?.color ?? '#3978FF'}
                      disabled={editingRole?.isEveryone}
                    />
                  </div>
                </div>
                <label className="role-hoist-card" htmlFor="role-hoist">
                  <span>
                    <strong>{messages.roleHoistLabel}</strong>
                  </span>
                  <input
                    id="role-hoist"
                    type="checkbox"
                    name="hoist"
                    defaultChecked={editingRole?.hoist ?? false}
                    disabled={editingRole?.isEveryone}
                  />
                </label>
                <label className="role-hoist-card" htmlFor="role-mentionable">
                  <span>
                    <strong>{messages.roleMentionableLabel}</strong>
                    <small>{messages.roleMentionableHint}</small>
                  </span>
                  <input
                    id="role-mentionable"
                    type="checkbox"
                    name="mentionable"
                    defaultChecked={editingRole?.mentionable ?? false}
                    disabled={editingRole?.isEveryone}
                  />
                </label>
              </div>
              <div className="permission-editor-panel" hidden={roleEditorTab !== 'permissions'}>
                <div className="permission-editor-intro">
                  <span className="permission-intro-icon" aria-hidden="true">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <strong>{messages.permissions}</strong>
                    <p>{messages.permissionSettingsHint}</p>
                  </div>
                </div>
                <label className="permission-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">{messages.searchPermissions}</span>
                  <input
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder={messages.searchPermissions}
                  />
                </label>
                <fieldset className="permission-grid">
                  <legend className="sr-only">{messages.permissions}</legend>
                  {permissionGroups.map((group) => {
                    const hasVisiblePermission = group.permissions.some(permissionMatchesSearch);
                    return (
                      <section
                        className="permission-category"
                        key={group.key}
                        hidden={!hasVisiblePermission}
                      >
                        <header>
                          <h4>{messages.serverPermissionGroups[group.key]}</h4>
                          <span>{group.permissions.length}</span>
                        </header>
                        <div>
                          {group.permissions.map((permission) => {
                            const canGrant =
                              activeServer.role === 'OWNER' ||
                              activeServer.permissions.includes(permission);
                            const isAssigned = Boolean(
                              editingRole?.permissions.includes(permission),
                            );
                            return (
                              <label
                                className={`permission-card${canGrant ? '' : ' permission-card--locked'}`}
                                key={permission}
                                hidden={!permissionMatchesSearch(permission)}
                                title={canGrant ? undefined : messages.permissionLockedHint}
                              >
                                {!canGrant && isAssigned && (
                                  <input type="hidden" name="permission" value={permission} />
                                )}
                                <span className="permission-copy">
                                  <span className="permission-title-row">
                                    <strong>{messages.serverPermissions[permission]}</strong>
                                    {!canGrant && <LockKeyhole size={13} aria-hidden="true" />}
                                  </span>
                                  <small>{messages.serverPermissionDescriptions[permission]}</small>
                                </span>
                                <span className="permission-switch">
                                  <input
                                    type="checkbox"
                                    name="permission"
                                    value={permission}
                                    defaultChecked={isAssigned}
                                    disabled={!canGrant}
                                    aria-label={messages.serverPermissions[permission]}
                                  />
                                  <span aria-hidden="true" />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </fieldset>
              </div>
              <div className="role-member-manager" hidden={roleEditorTab !== 'members'}>
                {editingRole &&
                  members
                    .filter((member) => member.role !== 'OWNER')
                    .map((member) => {
                      const assigned = member.roles.some((role) => role.id === editingRole.id);
                      return (
                        <div key={member.id}>
                          <span>
                            <strong>{member.displayName}</strong>
                            <small>@{member.username}</small>
                          </span>
                          <button
                            type="button"
                            disabled={busy || !canTarget(member)}
                            onClick={() =>
                              void run(
                                () =>
                                  apiRequest(
                                    `/servers/${activeServer.id}/members/${member.id}/roles/${editingRole.id}`,
                                    {
                                      method: assigned ? 'DELETE' : 'POST',
                                      ...(assigned ? {} : { body: '{}' }),
                                    },
                                  ),
                                assigned ? messages.roleUnassigned : messages.roleAssigned,
                              )
                            }
                          >
                            {assigned ? messages.remove : messages.add}
                          </button>
                        </div>
                      );
                    })}
              </div>
              <div className="role-editor-actions">
                <Button type="submit" disabled={busy}>
                  <Plus size={16} /> {editingRole ? messages.save : messages.createRole}
                </Button>
                {editingRole && !editingRole.isEveryone && (
                  <>
                    <Button type="reset" variant="secondary">
                      {messages.reset}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        void confirm(
                          `role:${editingRole.id}`,
                          () =>
                            apiRequest(`/servers/${activeServer.id}/roles/${editingRole.id}`, {
                              method: 'DELETE',
                            }),
                          messages.roleDeleted,
                        )
                      }
                    >
                      <Trash2 size={16} /> {messages.deleteRole}
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {section === 'members' && (
        <div className="moderation-members">
          <div className="member-management-filters">
            <label className="field member-search-field">
              <span>{messages.search}</span>
              <span className="input-with-icon">
                <Search size={15} />
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder={messages.search}
                />
              </span>
            </label>
            <label className="field">
              <span>{messages.status}</span>
              <select
                value={memberStatus}
                onChange={(event) => setMemberStatus(event.target.value)}
              >
                <option value="ALL">{messages.all}</option>
                <option value="ONLINE">{messages.online}</option>
                <option value="IDLE">{messages.idle}</option>
                <option value="DND">{messages.dnd}</option>
                <option value="OFFLINE">{messages.offline}</option>
              </select>
            </label>
            <label className="field">
              <span>{messages.roles}</span>
              <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                <option value="ALL">{messages.all}</option>
                {roles.data
                  ?.filter((role) => !role.isEveryone)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className={`member-admin-workspace${modMember ? ' mod-open' : ''}`}>
            <section className="member-admin-list">
              <div className="member-admin-columns" aria-hidden="true">
                <span>{messages.member}</span>
                <span>{messages.serverJoinedAt}</span>
                <span>{messages.roles}</span>
                <span>{messages.status}</span>
                <span />
              </div>
              {visibleMembers.map((member) => (
                <article
                  key={member.id}
                  className={`moderation-member moderation-member--table${modMemberId === member.id ? ' selected' : ''}`}
                  onDoubleClick={() => setModMemberId(member.id)}
                >
                  <div className="moderation-member-head">
                    <div className="user-avatar">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" />
                      ) : (
                        member.displayName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span>
                      <strong>{member.displayName}</strong>
                      <small>@{member.username}</small>
                    </span>
                  </div>
                  <time dateTime={member.joinedAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                      new Date(member.joinedAt),
                    )}
                  </time>
                  <div className="member-admin-role-chips">
                    {member.role === 'OWNER' && <span>{messages.owner}</span>}
                    {member.roles.slice(0, 2).map((role) => (
                      <span key={role.id} style={{ '--role-color': role.color } as CSSProperties}>
                        {role.name}
                      </span>
                    ))}
                    {member.roles.length > 2 && <small>+{member.roles.length - 2}</small>}
                  </div>
                  <div className="member-admin-signal">
                    <i className={`status-dot ${member.status.toLowerCase()}`} />
                    <span>
                      {
                        messages[
                          member.status.toLowerCase() as 'online' | 'idle' | 'dnd' | 'offline'
                        ]
                      }
                    </span>
                    {member.timeoutUntil && <Clock3 size={13} />}
                  </div>
                  <div className="member-admin-row-actions">
                    <button
                      className="icon-button"
                      aria-label={messages.modView}
                      title={messages.modView}
                      onClick={() => setModMemberId(member.id)}
                    >
                      <PanelRightOpen size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={messages.memberActions}
                      onClick={(event) => openMemberActions(event, member)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
            {modMember && (
              <aside className="member-mod-view">
                <header>
                  <div className="user-avatar">
                    {modMember.avatarUrl ? (
                      <img src={modMember.avatarUrl} alt="" />
                    ) : (
                      modMember.displayName[0]
                    )}
                  </div>
                  <span>
                    <strong>{modMember.displayName}</strong>
                    <small>@{modMember.username}</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={messages.close}
                    onClick={() => setModMemberId(null)}
                  >
                    <X size={17} />
                  </button>
                </header>
                <div className="member-mod-quick-actions">
                  {canTarget(modMember) && activeServer.permissions.includes('TIMEOUT_MEMBERS') && (
                    <button
                      onClick={() => setModerationDialog({ member: modMember, action: 'timeout' })}
                    >
                      <Clock3 size={16} />{' '}
                      {modMember.timeoutUntil ? messages.clearTimeout : messages.timeout}
                    </button>
                  )}
                  <button onClick={() => void navigator.clipboard.writeText(modMember.publicId)}>
                    <Copy size={16} /> {messages.copyUserId}
                  </button>
                </div>
                <section>
                  <h3>{messages.serverActivity}</h3>
                  <div className="member-mod-stat">
                    <span>{messages.moderationHistory}</span>
                    <strong>{modMemberHistory.data?.length ?? 0}</strong>
                  </div>
                  {(modMemberHistory.data ?? []).slice(0, 3).map((event) => (
                    <div className="member-mod-event" key={event.id}>
                      <span>
                        {(messages.auditActions as Record<string, string>)[event.action] ??
                          event.action}
                      </span>
                      <time dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                  ))}
                </section>
                <section>
                  <h3>{messages.roles}</h3>
                  <div className="member-role-toggles member-mod-roles">
                    {assignableRoles?.map((role) => {
                      const assigned = modMember.roles.some((item) => item.id === role.id);
                      return (
                        <button
                          className={assigned ? 'active' : ''}
                          key={role.id}
                          disabled={busy || !canManageRoles || !canTarget(modMember)}
                          onClick={() =>
                            void run(
                              () =>
                                apiRequest(
                                  `/servers/${activeServer.id}/members/${modMember.id}/roles/${role.id}`,
                                  {
                                    method: assigned ? 'DELETE' : 'POST',
                                    ...(assigned ? {} : { body: '{}' }),
                                  },
                                ),
                              assigned ? messages.roleUnassigned : messages.roleAssigned,
                            )
                          }
                        >
                          <i style={{ background: role.color }} /> {role.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <h3>{messages.account}</h3>
                  {modMember.createdAt && (
                    <div className="member-mod-info">
                      <CalendarDays size={15} />
                      <span>{messages.memberSince}</span>
                      <time>{new Date(modMember.createdAt).toLocaleDateString()}</time>
                    </div>
                  )}
                  <div className="member-mod-info">
                    <CalendarDays size={15} />
                    <span>{messages.serverJoinedAt}</span>
                    <time>{new Date(modMember.joinedAt).toLocaleDateString()}</time>
                  </div>
                  <div className="member-mod-info">
                    <Copy size={15} />
                    <span>{messages.wapveUserId}</span>
                    <code>{modMember.publicId}</code>
                  </div>
                </section>
              </aside>
            )}
          </div>
        </div>
      )}

      {section === 'bans' && (
        <div className="moderation-members">
          {bans.data?.map((ban) => (
            <article className="moderation-member" key={ban.user.id}>
              <div className="moderation-member-head">
                <div className="user-avatar">
                  {ban.user.avatarUrl ? (
                    <img src={ban.user.avatarUrl} alt="" />
                  ) : (
                    ban.user.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <span>
                  <strong>{ban.user.displayName}</strong>
                  <small>@{ban.user.username}</small>
                </span>
                <button
                  onClick={() =>
                    void run(
                      () =>
                        apiRequest(`/servers/${activeServer.id}/bans/${ban.user.id}`, {
                          method: 'DELETE',
                        }),
                      messages.memberUnbanned,
                    )
                  }
                >
                  {messages.unban}
                </button>
              </div>
              {ban.reason && <p>{ban.reason}</p>}
            </article>
          ))}
          {!bans.isPending && !bans.data?.length && (
            <p className="social-empty-copy large">{messages.noBans}</p>
          )}
        </div>
      )}

      {section === 'automod' && (
        <ServerAutoModPanel serverId={activeServer.id} messages={messages} />
      )}

      {section === 'audit' && (
        <div className="audit-log-list">
          <div className="audit-filters">
            <label>
              <span>{messages.eventType}</span>
              <select value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
                <option value="">{messages.allEvents}</option>
                {Object.entries(messages.auditActions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages.actor}</span>
              <select value={auditActor} onChange={(event) => setAuditActor(event.target.value)}>
                <option value="">{messages.everyone}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages.target}</span>
              <select value={auditTarget} onChange={(event) => setAuditTarget(event.target.value)}>
                <option value="">{messages.everyone}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {audit.data?.items.map((event) => (
            <article key={event.id} className="audit-log-item">
              <div>
                <strong>
                  {(messages.auditActions as Record<string, string>)[event.action] ??
                    event.action
                      .split('_')
                      .map((part) => part.toLocaleLowerCase())
                      .join(' ')}
                </strong>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </div>
              <p>
                {event.actor?.displayName ?? messages.system} →{' '}
                {event.target?.displayName ?? event.role?.name ?? event.channel?.name ?? '—'}
              </p>
              {event.reason && (
                <small>
                  {messages.reason}: {event.reason}
                </small>
              )}
            </article>
          ))}
          {!audit.isPending && !audit.data?.items.length && (
            <p className="social-empty-copy large">{messages.noAuditLogs}</p>
          )}
        </div>
      )}

      {memberActions &&
        createPortal(
          <div
            className="member-context-menu member-admin-actions-menu"
            role="menu"
            style={{ left: memberActions.left, top: memberActions.top }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="member-context-head">
              <strong>{memberActions.member.displayName}</strong>
              <span>@{memberActions.member.username}</span>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setModMemberId(memberActions.member.id);
                setMemberActions(null);
              }}
            >
              <PanelRightOpen size={15} /> {messages.modView}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                void navigator.clipboard.writeText(memberActions.member.publicId);
                setMemberActions(null);
              }}
            >
              <Copy size={15} /> {messages.copyUserId}
            </button>
            {memberActions.member.id !== currentUserId && (
              <button
                role="menuitem"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      apiRequest('/social/requests', {
                        method: 'POST',
                        body: JSON.stringify({ username: memberActions.member.username }),
                      }),
                    messages.friendRequestPending,
                  ).then(() => setMemberActions(null))
                }
              >
                <Plus size={15} /> {messages.addFriend}
              </button>
            )}
            {canTarget(memberActions.member) && <div className="member-context-separator" />}
            {canTarget(memberActions.member) &&
              activeServer.permissions.includes('TIMEOUT_MEMBERS') && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setModerationDialog({ member: memberActions.member, action: 'timeout' });
                    setMemberActions(null);
                  }}
                >
                  <Clock3 size={15} />{' '}
                  {memberActions.member.timeoutUntil ? messages.clearTimeout : messages.timeout}
                </button>
              )}
            {canTarget(memberActions.member) &&
              activeServer.permissions.includes('KICK_MEMBERS') && (
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setModerationDialog({ member: memberActions.member, action: 'kick' });
                    setMemberActions(null);
                  }}
                >
                  <UserMinus size={15} /> {messages.kick}
                </button>
              )}
            {canTarget(memberActions.member) &&
              activeServer.permissions.includes('BAN_MEMBERS') && (
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setModerationDialog({ member: memberActions.member, action: 'ban' });
                    setMemberActions(null);
                  }}
                >
                  <Ban size={15} /> {messages.ban}
                </button>
              )}
          </div>,
          document.body,
        )}

      <Dialog.Root
        open={Boolean(moderationDialog)}
        onOpenChange={(open) => !open && setModerationDialog(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay moderation-action-overlay" />
          <Dialog.Content className="compact-dialog moderation-action-dialog">
            <div className="settings-title">
              <div>
                <Dialog.Title>{messages.moderationAction}</Dialog.Title>
                <Dialog.Description>{moderationDialog?.member.displayName}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button aria-label={messages.close}>
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            {moderationDialog && (
              <>
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const reason = formString(data, 'reason').trim() || undefined;
                    const durationValue = formString(data, 'durationMinutes', '10');
                    const durationMinutes =
                      durationValue === 'custom'
                        ? Number(data.get('customDuration'))
                        : durationValue === 'clear'
                          ? null
                          : Number(durationValue);
                    const path =
                      moderationDialog.action === 'timeout'
                        ? `/servers/${activeServer.id}/members/${moderationDialog.member.id}/timeout`
                        : `/servers/${activeServer.id}/members/${moderationDialog.member.id}/actions/${moderationDialog.action}`;
                    const body =
                      moderationDialog.action === 'timeout'
                        ? { durationMinutes, reason }
                        : moderationDialog.action === 'ban'
                          ? { reason, deleteMessageSeconds: data.get('deleteMessageSeconds') }
                          : { reason };
                    const success =
                      moderationDialog.action === 'warn'
                        ? messages.memberWarned
                        : moderationDialog.action === 'timeout'
                          ? durationMinutes === null
                            ? messages.timeoutCleared
                            : messages.memberTimedOut
                          : moderationDialog.action === 'kick'
                            ? messages.memberKicked
                            : messages.memberBanned;
                    void run(
                      () =>
                        apiRequest(path, {
                          method: moderationDialog.action === 'timeout' ? 'PATCH' : 'POST',
                          body: JSON.stringify(body),
                        }),
                      success,
                    ).then((succeeded) => succeeded && setModerationDialog(null));
                  }}
                >
                  {moderationDialog.action === 'timeout' && (
                    <>
                      <label className="field">
                        <span>{messages.duration}</span>
                        <select
                          name="durationMinutes"
                          defaultValue={moderationDialog.member.timeoutUntil ? 'clear' : '10'}
                        >
                          {moderationDialog.member.timeoutUntil && (
                            <option value="clear">{messages.clearTimeout}</option>
                          )}
                          <option value="5">5 {messages.minutes}</option>
                          <option value="10">10 {messages.minutes}</option>
                          <option value="60">1 {messages.hour}</option>
                          <option value="1440">1 {messages.day}</option>
                          <option value="10080">7 {messages.days}</option>
                          <option value="custom">{messages.customDuration}</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>{messages.customDurationMinutes}</span>
                        <input
                          name="customDuration"
                          type="number"
                          min={1}
                          max={40320}
                          defaultValue={10}
                        />
                      </label>
                    </>
                  )}
                  {moderationDialog.action === 'ban' && (
                    <label className="field">
                      <span>{messages.deleteRecentMessages}</span>
                      <select name="deleteMessageSeconds" defaultValue="0">
                        <option value="0">{messages.deleteNone}</option>
                        <option value="3600">{messages.lastHour}</option>
                        <option value="21600">{messages.lastSixHours}</option>
                        <option value="86400">{messages.lastDay}</option>
                        <option value="604800">{messages.lastSevenDays}</option>
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>{messages.reasonOptional}</span>
                    <textarea name="reason" maxLength={512} rows={4} />
                  </label>
                  <div className="role-editor-actions">
                    <Dialog.Close asChild>
                      <Button type="button" variant="secondary">
                        {messages.cancel}
                      </Button>
                    </Dialog.Close>
                    <Button
                      type="submit"
                      variant={
                        moderationDialog.action === 'warn' || moderationDialog.action === 'timeout'
                          ? 'primary'
                          : 'danger'
                      }
                      disabled={busy}
                    >
                      {messages.confirm}
                    </Button>
                  </div>
                </form>
                <section className="moderation-history">
                  <h3>{messages.moderationHistory}</h3>
                  {moderationHistory.data?.slice(0, 8).map((event) => (
                    <div key={event.id}>
                      <span>
                        {(messages.auditActions as Record<string, string>)[event.action] ??
                          event.action}
                      </span>
                      <time dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                  ))}
                  {!moderationHistory.isPending && !moderationHistory.data?.length && (
                    <p>{messages.noModerationHistory}</p>
                  )}
                </section>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

type AutomodMultiSelectOption = { id: string; label: string };

function AutomodMultiSelect({
  name,
  label,
  placeholder,
  removeLabel,
  emptyLabel,
  values,
  options,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  removeLabel: string;
  emptyLabel: string;
  values: string[];
  options: AutomodMultiSelectOption[];
  onChange: (values: string[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  const selected = new Set(values);
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  const visibleOptions = options.filter((option) => {
    if (!normalizedQuery) return true;
    return option.label.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
  });

  function toggle(optionId: string) {
    onChange(selected.has(optionId) ? values.filter((id) => id !== optionId) : [...values, optionId]);
    setQuery('');
  }

  function remove(optionId: string) {
    onChange(values.filter((id) => id !== optionId));
  }

  return (
    <div className="field automod-picker-field" ref={rootRef}>
      <span>{label}</span>
      <div className={`automod-picker${open ? ' open' : ''}`}>
        <div
          className="automod-picker-control"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen(true)}
        >
          <div className="automod-picker-chips">
            {values.map((value) => {
              const option = options.find((item) => item.id === value);
              return (
                <span className="automod-picker-chip" key={value}>
                  <span>{option?.label ?? value}</span>
                  <button
                    type="button"
                    aria-label={`${option?.label ?? value} ${removeLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(value);
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              );
            })}
            <input
              className="automod-picker-input"
              value={query}
              placeholder={values.length ? '' : placeholder}
              aria-label={placeholder}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false);
                  return;
                }
                if (event.key === 'Backspace' && !query && values.length) {
                  onChange(values.slice(0, -1));
                }
              }}
            />
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        {open && (
          <div className="automod-picker-menu" role="listbox" aria-label={label}>
            {visibleOptions.length ? (
              visibleOptions.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected.has(option.id)}
                  className={selected.has(option.id) ? 'selected' : ''}
                  key={option.id}
                  onClick={() => toggle(option.id)}
                >
                  <span className="automod-picker-check" aria-hidden="true">
                    {selected.has(option.id) ? '✓' : ''}
                  </span>
                  <span>{option.label}</span>
                </button>
              ))
            ) : (
              <p className="automod-picker-empty">{emptyLabel}</p>
            )}
          </div>
        )}
      </div>
      {values.map((value) => (
        <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
      ))}
    </div>
  );
}

function ServerAutoModPanel({ serverId, messages }: { serverId: string; messages: Dictionary }) {
  const { data, refetch, isPending } = useQuery({
    queryKey: ['automod', serverId],
    queryFn: () => apiRequest<AutoModConfig>(`/servers/${serverId}/automod`),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [exemptRoles, setExemptRoles] = useState<string[]>([]);
  const [exemptChannels, setExemptChannels] = useState<string[]>([]);
  const [showBannedWords, setShowBannedWords] = useState(false);
  const roleOptions = useQuery({
    queryKey: ['server-roles', serverId],
    queryFn: () => apiRequest<ServerRole[]>(`/servers/${serverId}/roles`),
  });
  const channelOptions = useQuery({
    queryKey: ['server-channels', serverId],
    queryFn: () => apiRequest<ChannelTree>(`/servers/${serverId}/channels`),
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setExemptRoles(data.exemptRoles);
    setExemptChannels(data.exemptChannels);
  }, [data]);

  if (isPending || !data) return <p>{messages.loading}</p>;

  function applyPreset(
    form: HTMLFormElement | null,
    preset: 'language' | 'links' | 'spam' | 'raid' | 'all',
  ) {
    if (!form) return;
    const setChecked = (name: string) => {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.checked = true;
    };
    const rules =
      preset === 'all'
        ? [
            'bannedWordsEnabled',
            'regexEnabled',
            'linkProtection',
            'spamProtection',
            'repeatedMessageProtection',
            'mentionSpamProtection',
            'capsProtection',
            'emojiSpamProtection',
          ]
        : preset === 'language'
          ? ['bannedWordsEnabled']
          : preset === 'links'
            ? ['linkProtection']
            : preset === 'spam'
              ? [
                  'spamProtection',
                  'repeatedMessageProtection',
                  'capsProtection',
                  'emojiSpamProtection',
                ]
              : ['mentionSpamProtection', 'spamProtection'];
    rules.forEach(setChecked);
    const global = form.elements.namedItem('enabled') as HTMLInputElement | null;
    if (global) global.checked = true;
    setEnabled(true);
    if (preset === 'language' || preset === 'all') {
      const field = form.elements.namedItem('bannedWords') as HTMLInputElement | null;
      if (field && !field.value.trim()) field.value = TURKISH_PROFANITY_PRESET.join(', ');
    }
    setNotice(messages.automodPresetApplied);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    const formData = new FormData(event.currentTarget);
    const bannedWordsValue = formData.get('bannedWords');
    const allowedDomainsValue = formData.get('allowedDomains');
    const regexPatternsValue = formData.get('regexPatterns');
    const payload = {
      enabled: formData.get('enabled') === 'on',

      bannedWordsEnabled: formData.get('bannedWordsEnabled') === 'on',
      bannedWordsAction: formData.get('bannedWordsAction'),
      bannedWords:
        typeof bannedWordsValue === 'string'
          ? bannedWordsValue
              .split(',')
              .map((word) => word.trim())
              .filter(Boolean)
          : [],

      regexEnabled: formData.get('regexEnabled') === 'on',
      regexAction: formData.get('regexAction'),
      regexPatterns:
        typeof regexPatternsValue === 'string'
          ? regexPatternsValue
              .split(/\r?\n/u)
              .map((pattern) => pattern.trim())
              .filter(Boolean)
          : [],

      linkProtection: formData.get('linkProtection') === 'on',
      linkProtectionAction: formData.get('linkProtectionAction'),
      allowedDomains:
        typeof allowedDomainsValue === 'string'
          ? allowedDomainsValue
              .split(',')
              .map((domain) => domain.trim())
              .filter(Boolean)
          : [],

      spamProtection: formData.get('spamProtection') === 'on',
      spamMaxMessages: Number(formData.get('spamMaxMessages')),
      spamInterval: Number(formData.get('spamInterval')),
      spamAction: formData.get('spamAction'),

      repeatedMessageProtection: formData.get('repeatedMessageProtection') === 'on',
      repeatedMessageMax: Number(formData.get('repeatedMessageMax')),
      repeatedMessageInterval: Number(formData.get('repeatedMessageInterval')),
      repeatedMessageAction: formData.get('repeatedMessageAction'),

      mentionSpamProtection: formData.get('mentionSpamProtection') === 'on',
      mentionMaxCount: Number(formData.get('mentionMaxCount')),
      mentionAction: formData.get('mentionAction'),

      capsProtection: formData.get('capsProtection') === 'on',
      capsMinLength: Number(formData.get('capsMinLength')),
      capsPercentage: Number(formData.get('capsPercentage')),
      capsAction: formData.get('capsAction'),

      emojiSpamProtection: formData.get('emojiSpamProtection') === 'on',
      emojiMaxCount: Number(formData.get('emojiMaxCount')),
      emojiAction: formData.get('emojiAction'),
      exemptRoles,
      exemptChannels,
      logChannelId: formString(formData, 'logChannelId') || null,
    };

    try {
      await apiRequest(`/servers/${serverId}/automod`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setNotice(messages.automodSaved);
      await refetch();
    } catch (err) {
      setError(errorMessage(err, messages));
    } finally {
      setBusy(false);
    }
  }

  const actions: { value: AutoModAction; label: string }[] = [
    { value: 'DELETE_MESSAGE', label: 'Mesajı Sil' },
    { value: 'WARN_USER', label: 'Kullanıcıyı Uyar' },
    { value: 'TIMEOUT_5M', label: '5 Dakika Sustur' },
    { value: 'TIMEOUT_30M', label: '30 Dakika Sustur' },
    { value: 'TIMEOUT_1H', label: '1 Saat Sustur' },
  ];

  return (
    <form className="server-automod-panel" onSubmit={(event) => void handleSubmit(event)}>
      {error && <div className="form-error">{error}</div>}
      {notice && (
        <div className="form-notice" style={{ color: 'var(--success)' }}>
          {notice}
        </div>
      )}

      <div className="automod-hero">
        <div className="automod-hero-icon">
          <ShieldCheck size={26} />
        </div>
        <div>
          <span className="settings-eyebrow">WAPVE SHIELD</span>
          <h3>{messages.automodProtectionCenter}</h3>
          <p>{messages.automodProtectionHint}</p>
        </div>
        <span className={`automod-health ${enabled ? 'active' : ''}`}>
          {enabled ? messages.active : messages.disabled}
        </span>
      </div>

      <section className="automod-presets">
        <header>
          <div>
            <h3>{messages.automodReadyRules}</h3>
            <p>{messages.automodReadyRulesHint}</p>
          </div>
        </header>
        <div className="automod-preset-grid">
          {(
            [
              ['language', messages.automodPresetLanguage, messages.automodPresetLanguageHint],
              ['links', messages.automodPresetLinks, messages.automodPresetLinksHint],
              ['spam', messages.automodPresetSpam, messages.automodPresetSpamHint],
              ['raid', messages.automodPresetRaid, messages.automodPresetRaidHint],
            ] as const
          ).map(([preset, title, description]) => (
            <button
              type="button"
              key={preset}
              onClick={(event) => applyPreset(event.currentTarget.form, preset)}
            >
              <span>
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
              <b>{messages.enable}</b>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={(event) => applyPreset(event.currentTarget.form, 'all')}
        >
          {messages.enableRecommendedProtection}
        </Button>
      </section>

      <div
        className="field-checkbox"
        style={{
          marginBottom: 24,
          padding: 16,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
        }}
      >
        <input
          id="am-enabled"
          type="checkbox"
          name="enabled"
          defaultChecked={data.enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <label htmlFor="am-enabled" style={{ fontSize: 16, fontWeight: 'bold' }}>
          Wapve Guard'ı Aktifleştir
        </label>
        <p style={{ marginLeft: 28, fontSize: 13, color: 'var(--text-muted)' }}>
          Wapve Guard kuralları sunucunuzu spam, kötü amaçlı bağlantılar ve kural ihlallerine karşı
          korur.
        </p>
      </div>

      <div
        className="automod-rules"
        style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}
      >
        <section
          className="automod-rule-section"
          style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}
        >
          <div className="field-checkbox">
            <input
              id="am-spam"
              type="checkbox"
              name="spamProtection"
              defaultChecked={data.spamProtection}
            />
            <label htmlFor="am-spam" style={{ fontWeight: 'bold' }}>
              Spam Koruması
            </label>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}
          >
            <label className="field-label">
              <span>Aralık (saniye)</span>
              <input
                type="number"
                name="spamInterval"
                defaultValue={data.spamInterval}
                min={2}
                max={30}
              />
            </label>
            <label className="field-label">
              <span>Maksimum Mesaj</span>
              <input
                type="number"
                name="spamMaxMessages"
                defaultValue={data.spamMaxMessages}
                min={2}
                max={20}
              />
            </label>
            <label className="field-label">
              <span>Aksiyon</span>
              <select name="spamAction" defaultValue={data.spamAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="automod-rule-section">
          <div className="field-checkbox">
            <input
              id="am-repeat"
              type="checkbox"
              name="repeatedMessageProtection"
              defaultChecked={data.repeatedMessageProtection}
            />
            <label htmlFor="am-repeat">{messages.automodRepeatedMessages}</label>
          </div>
          <div className="automod-rule-grid">
            <label className="field-label">
              <span>{messages.intervalSeconds}</span>
              <input
                type="number"
                name="repeatedMessageInterval"
                defaultValue={data.repeatedMessageInterval}
                min={5}
                max={120}
              />
            </label>
            <label className="field-label">
              <span>{messages.maximumCount}</span>
              <input
                type="number"
                name="repeatedMessageMax"
                defaultValue={data.repeatedMessageMax}
                min={2}
                max={10}
              />
            </label>
            <label className="field-label">
              <span>{messages.action}</span>
              <select name="repeatedMessageAction" defaultValue={data.repeatedMessageAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="automod-rule-section">
          <div className="field-checkbox">
            <input
              id="am-mention"
              type="checkbox"
              name="mentionSpamProtection"
              defaultChecked={data.mentionSpamProtection}
            />
            <label htmlFor="am-mention">{messages.automodMentionSpam}</label>
          </div>
          <div className="automod-rule-grid">
            <label className="field-label">
              <span>{messages.maximumMentions}</span>
              <input
                type="number"
                name="mentionMaxCount"
                defaultValue={data.mentionMaxCount}
                min={2}
                max={50}
              />
            </label>
            <label className="field-label">
              <span>{messages.action}</span>
              <select name="mentionAction" defaultValue={data.mentionAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section
          className="automod-rule-section"
          style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}
        >
          <div className="field-checkbox">
            <input
              id="am-link"
              type="checkbox"
              name="linkProtection"
              defaultChecked={data.linkProtection}
            />
            <label htmlFor="am-link" style={{ fontWeight: 'bold' }}>
              Bağlantı Koruması (Linkler yasaklanır)
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
            <label className="field-label">
              <span>Aksiyon</span>
              <select name="linkProtectionAction" defaultValue={data.linkProtectionAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>{messages.allowedDomains}</span>
              <input
                name="allowedDomains"
                defaultValue={data.allowedDomains.join(', ')}
                placeholder="wapve.com, example.org"
              />
            </label>
          </div>
        </section>

        <section
          className="automod-rule-section"
          style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}
        >
          <div className="field-checkbox">
            <input
              id="am-words"
              type="checkbox"
              name="bannedWordsEnabled"
              defaultChecked={data.bannedWordsEnabled}
            />
            <label htmlFor="am-words" style={{ fontWeight: 'bold' }}>
              {messages.automodBannedWordFilter}
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
            <label className="field-label">
              <span>{messages.automodBannedWords}</span>
              <span className={`automod-secret-field${showBannedWords ? ' revealed' : ''}`}>
                <input
                  type={showBannedWords ? 'text' : 'password'}
                  name="bannedWords"
                  defaultValue={data.bannedWords.join(', ')}
                  placeholder={messages.automodBannedWordsPlaceholder}
                  autoComplete="off"
                  readOnly={!showBannedWords}
                  aria-label={
                    showBannedWords ? messages.automodBannedWords : messages.automodRevealWordList
                  }
                  title={showBannedWords ? undefined : messages.automodRevealWordList}
                  onClick={() => {
                    if (!showBannedWords) setShowBannedWords(true);
                  }}
                />
              </span>
            </label>
            <label className="field-label">
              <span>{messages.action}</span>
              <select name="bannedWordsAction" defaultValue={data.bannedWordsAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="automod-rule-section automod-regex-section">
          <div className="field-checkbox">
            <input
              id="am-regex"
              type="checkbox"
              name="regexEnabled"
              defaultChecked={data.regexEnabled}
            />
            <label htmlFor="am-regex">{messages.automodRegexRules}</label>
          </div>
          <p className="automod-rule-hint">{messages.automodRegexHint}</p>
          <div className="automod-regex-grid">
            <label className="field-label">
              <span>{messages.automodRegexPatterns}</span>
              <textarea
                name="regexPatterns"
                defaultValue={data.regexPatterns.join('\n')}
                placeholder={'\\b(?:istenmeyen|yasakli)[-_ ]?ifade\\b\nhttps?:\\/\\/[^\\s]+'}
                rows={5}
                spellCheck={false}
              />
            </label>
            <label className="field-label">
              <span>{messages.action}</span>
              <select name="regexAction" defaultValue={data.regexAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section
          className="automod-rule-section"
          style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}
        >
          <div className="field-checkbox">
            <input
              id="am-caps"
              type="checkbox"
              name="capsProtection"
              defaultChecked={data.capsProtection}
            />
            <label htmlFor="am-caps" style={{ fontWeight: 'bold' }}>
              Büyük Harf (Caps) Koruması
            </label>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}
          >
            <label className="field-label">
              <span>Min. Uzunluk</span>
              <input
                type="number"
                name="capsMinLength"
                defaultValue={data.capsMinLength}
                min={5}
                max={50}
              />
            </label>
            <label className="field-label">
              <span>Yüzde Sınırı (%)</span>
              <input
                type="number"
                name="capsPercentage"
                defaultValue={data.capsPercentage}
                min={50}
                max={100}
              />
            </label>
            <label className="field-label">
              <span>Aksiyon</span>
              <select name="capsAction" defaultValue={data.capsAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="automod-rule-section" style={{ marginBottom: 24 }}>
          <div className="field-checkbox">
            <input
              id="am-emoji"
              type="checkbox"
              name="emojiSpamProtection"
              defaultChecked={data.emojiSpamProtection}
            />
            <label htmlFor="am-emoji" style={{ fontWeight: 'bold' }}>
              Emoji Spam Koruması
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <label className="field-label">
              <span>Maksimum Emoji Sayısı</span>
              <input
                type="number"
                name="emojiMaxCount"
                defaultValue={data.emojiMaxCount}
                min={3}
                max={50}
              />
            </label>
            <label className="field-label">
              <span>Aksiyon</span>
              <select name="emojiAction" defaultValue={data.emojiAction}>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="automod-rule-section automod-exemptions">
          <h3>{messages.automodExemptions}</h3>
          <AutomodMultiSelect
            name="exemptRoles"
            label={messages.roles}
            placeholder={messages.automodExemptionSearch}
            removeLabel={messages.remove}
            emptyLabel={messages.automodNoExemptionResults}
            values={exemptRoles}
            options={
              roleOptions.data
                ?.filter((role) => !role.isEveryone)
                .map((role) => ({ id: role.id, label: role.name })) ?? []
            }
            onChange={setExemptRoles}
          />
          <AutomodMultiSelect
            name="exemptChannels"
            label={messages.channels}
            placeholder={messages.automodExemptionSearch}
            removeLabel={messages.remove}
            emptyLabel={messages.automodNoExemptionResults}
            values={exemptChannels}
            options={
              channelOptions.data?.channels.map((channel) => ({
                id: channel.id,
                label: `#${channel.name}`,
              })) ?? []
            }
            onChange={setExemptChannels}
          />
          <label className="field">
            <span>{messages.automodLogChannel}</span>
            <select name="logChannelId" defaultValue={data.logChannelId ?? ''}>
              <option value="">{messages.none}</option>
              {channelOptions.data?.channels
                .filter((channel) => channel.type === 'TEXT')
                .map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
            </select>
          </label>
        </section>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" disabled={busy}>
          {messages.saveSettings}
        </Button>
      </div>
    </form>
  );
}
