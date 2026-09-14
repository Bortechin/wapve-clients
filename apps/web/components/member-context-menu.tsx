'use client';

import type { ServerMember, ServerRole, ServerSummary } from '@wapve/contracts';
import { Ban, Check, Clock3, Copy, Settings, Shield, UserMinus, ChevronRight } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import type { ServerSettingsSection } from './server-settings-dialog';
import { MemberModerationDialog, type MemberModerationAction } from './member-moderation-dialog';

type Position = { left: number; top: number };

export function MemberContextMenu({
  children,
  member,
  currentMember,
  currentUserId,
  server,
  roles,
  developerMode,
  messages,
  onChanged,
  onNotice,
  onOpenSettings,
  renderLeadingActions,
  suppressLeadingActionsSelector,
}: {
  children: ReactNode;
  member: ServerMember;
  currentMember: ServerMember | undefined;
  currentUserId: string;
  server: ServerSummary;
  roles: ServerRole[];
  developerMode: boolean;
  messages: Dictionary;
  onChanged: () => Promise<unknown>;
  onNotice: (notice: string) => void;
  onOpenSettings: (section: ServerSettingsSection) => void;
  renderLeadingActions?: (close: () => void) => ReactNode;
  suppressLeadingActionsSelector?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const submenuTriggerRef = useRef<HTMLButtonElement>(null);
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [showLeadingActions, setShowLeadingActions] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [moderationAction, setModerationAction] = useState<MemberModerationAction | null>(null);
  const actorIsOwner = server.role === 'OWNER';

  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !submenuRef.current?.contains(event.target as Node)
      ) {
        setPosition(null);
      }
    };
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPosition(null);
    };
    const closeOnViewportChange = () => setPosition(null);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus(),
    );
    return () => {
      if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [position]);

  const actorHighestRole = actorIsOwner
    ? Number.MAX_SAFE_INTEGER
    : Math.max(-1, ...(currentMember?.roles.map((role) => role.position) ?? []));
  const targetHighestRole = Math.max(-1, ...member.roles.map((role) => role.position));
  const canModerateTarget =
    member.role !== 'OWNER' &&
    member.id !== currentUserId &&
    (actorIsOwner || targetHighestRole < actorHighestRole);
  const canManageTargetRoles =
    (actorIsOwner && member.id === currentUserId) ||
    (member.role !== 'OWNER' &&
      member.id !== currentUserId &&
      targetHighestRole < actorHighestRole);
  const assignableRoles = roles.filter(
    (role) =>
      !role.isEveryone &&
      (actorIsOwner ||
        (role.position < actorHighestRole &&
          role.permissions.every((permission) => server.permissions.includes(permission)))),
  );

  function cancelSubmenuClose() {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
    submenuCloseTimer.current = null;
  }

  function closeSubmenuSoon() {
    cancelSubmenuClose();
    submenuCloseTimer.current = setTimeout(() => setSubmenuOpen(null), 180);
  }

  function openSubmenu() {
    cancelSubmenuClose();
    const rect = submenuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 252;
    const height = Math.min(assignableRoles.length * 38 + 16, window.innerHeight - 16);
    const opensLeft = rect.right + width + 6 > window.innerWidth;
    setSubmenuOpen({
      left: opensLeft ? Math.max(8, rect.left - width - 4) : rect.right + 4,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
    });
  }

  function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + buttons.length) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  function openAt(clientX: number, clientY: number) {
    const width = 252;
    setPosition({
      left: Math.max(8, Math.min(clientX, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(clientY, window.innerHeight - 420)),
    });
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    setShowLeadingActions(
      !suppressLeadingActionsSelector || !target?.closest(suppressLeadingActionsSelector),
    );
    openAt(event.clientX, event.clientY);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    openAt(bounds.left + 24, bounds.top + 24);
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setPosition(null);
    } catch {
      onNotice(messages.copyFailed);
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      onNotice(success);
      setPosition(null);
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  function openModerationDialog(action: MemberModerationAction) {
    setPosition(null);
    setModerationAction(action);
  }

  return (
    <>
      <div
        className="member-context-trigger"
        tabIndex={0}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            className="member-context-menu"
            role="menu"
            aria-label={`${member.displayName} ${messages.memberActions}`}
            style={position}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={moveMenuFocus}
          >
            <div className="member-context-head">
              <strong>{member.displayName}</strong>
              <span>@{member.username}</span>
            </div>
            {showLeadingActions && renderLeadingActions?.(() => setPosition(null))}
            {showLeadingActions && renderLeadingActions && (
              <div className="member-context-separator" />
            )}
            <button role="menuitem" onClick={() => void copy(member.username)}>
              <Copy size={15} /> {messages.copyUsername}
            </button>
            {developerMode && (
              <button role="menuitem" onClick={() => void copy(member.publicId)}>
                <Copy size={15} /> {messages.copyUserId}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setPosition(null);
                onOpenSettings('members');
              }}
            >
              <Settings size={15} /> {messages.openMemberSettings}
            </button>
            {canManageTargetRoles &&
              server.permissions.includes('MANAGE_ROLES') &&
              assignableRoles.length > 0 && (
                <div
                  className="member-context-submenu-wrapper"
                  onMouseEnter={openSubmenu}
                  onMouseLeave={closeSubmenuSoon}
                >
                  <button
                    ref={submenuTriggerRef}
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={Boolean(submenuOpen)}
                    className="member-context-submenu-trigger"
                    onClick={() => (submenuOpen ? setSubmenuOpen(null) : openSubmenu())}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowRight' ||
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();
                        openSubmenu();
                        requestAnimationFrame(() =>
                          submenuRef.current?.querySelector('button')?.focus(),
                        );
                      }
                    }}
                  >
                    <Shield size={15} />
                    <span>{messages.roles}</span>
                    <ChevronRight size={15} />
                  </button>
                  {submenuOpen &&
                    createPortal(
                      <div
                        ref={submenuRef}
                        className="member-context-menu member-context-submenu"
                        role="menu"
                        style={{ ...submenuOpen, position: 'fixed' }}
                        onMouseEnter={cancelSubmenuClose}
                        onMouseLeave={closeSubmenuSoon}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                            event.preventDefault();
                            setSubmenuOpen(null);
                            submenuTriggerRef.current?.focus();
                            return;
                          }
                          moveMenuFocus(event);
                        }}
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        {assignableRoles.map((role) => {
                          const assigned = member.roles.some((item) => item.id === role.id);
                          return (
                            <button
                              role="menuitemcheckbox"
                              aria-checked={assigned}
                              disabled={busy}
                              key={role.id}
                              onClick={() =>
                                void run(
                                  () =>
                                    apiRequest(
                                      `/servers/${server.id}/members/${member.id}/roles/${role.id}`,
                                      {
                                        method: assigned ? 'DELETE' : 'POST',
                                        ...(assigned ? {} : { body: '{}' }),
                                      },
                                    ),
                                  assigned ? messages.roleUnassigned : messages.roleAssigned,
                                )
                              }
                            >
                              <i style={{ background: role.color }} />
                              {role.name}
                              {assigned && <Check className="member-context-check" size={14} />}
                            </button>
                          );
                        })}
                      </div>,
                      document.body,
                    )}
                </div>
              )}
            {canModerateTarget &&
              server.permissions.some((permission) =>
                ['TIMEOUT_MEMBERS', 'KICK_MEMBERS', 'BAN_MEMBERS'].includes(permission),
              ) && <div className="member-context-separator" />}
            {canModerateTarget && server.permissions.includes('TIMEOUT_MEMBERS') && (
              <button
                role="menuitem"
                disabled={busy}
                onClick={() => openModerationDialog('timeout')}
              >
                <Clock3 size={15} />
                {member.timeoutUntil ? messages.clearTimeout : messages.timeoutTenMinutes}
              </button>
            )}
            {canModerateTarget && server.permissions.includes('KICK_MEMBERS') && (
              <button
                className="danger"
                role="menuitem"
                disabled={busy}
                onClick={() => openModerationDialog('kick')}
              >
                <UserMinus size={15} /> {messages.kick}
              </button>
            )}
            {canModerateTarget && server.permissions.includes('BAN_MEMBERS') && (
              <button
                className="danger"
                role="menuitem"
                disabled={busy}
                onClick={() => openModerationDialog('ban')}
              >
                <Ban size={15} /> {messages.ban}
              </button>
            )}
          </div>,
          document.body,
        )}
      <MemberModerationDialog
        action={moderationAction}
        member={member}
        server={server}
        messages={messages}
        onClose={() => setModerationAction(null)}
        onChanged={onChanged}
        onNotice={onNotice}
      />
    </>
  );
}
