'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationLevel,
  ServerNotificationPreference,
  ServerSummary,
} from '@wapve/contracts';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  LogOut,
  PlusCircle,
  Settings,
  Sparkles,
  UserPlus,
  Waves,
  X,
} from 'lucide-react';
import { ServerTagChip } from './server-tag-chip';
import { useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import type { ServerSettingsSection } from './server-settings-dialog';

export function ServerHeader({
  server,
  locale,
  messages,
  canAccessSettings,
  canManageChannels,
  canInvite,
  onInvite,
  onOpenSettings,
  onOpenWoost,
  onOpenTags,
  onEditProfile,
  onCreateChannel,
  onCreateCategory,
  onLeave,
  onNotice,
}: {
  server: ServerSummary;
  locale: 'tr' | 'en';
  messages: Dictionary;
  canAccessSettings: boolean;
  canManageChannels: boolean;
  canInvite: boolean;
  onInvite: () => void;
  onOpenSettings: (section?: ServerSettingsSection) => void;
  onOpenWoost: () => void;
  onOpenTags: () => void;
  onEditProfile: () => void;
  onCreateChannel: () => void;
  onCreateCategory: () => void;
  onLeave: () => Promise<void>;
  onNotice: (notice: string) => void;
}) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const preference = useQuery({
    queryKey: ['server-notification-preference', server.id],
    queryFn: () =>
      apiRequest<ServerNotificationPreference>(`/servers/${server.id}/notification-preference`),
    enabled: isOpen,
  });

  const currentLevel: NotificationLevel = preference.data?.level ?? 'ALL_MESSAGES';

  async function updateNotificationLevel(level: NotificationLevel) {
    try {
      await apiRequest(`/servers/${server.id}/notification-preference`, {
        method: 'PATCH',
        body: JSON.stringify({ level }),
      });
      await queryClient.invalidateQueries({
        queryKey: ['server-notification-preference', server.id],
      });
      onNotice(
        locale === 'tr'
          ? 'Bildirim ayarları güncellendi.'
          : 'Notification settings updated.',
      );
      setIsOpen(false);
    } catch {
      onNotice(messages.genericError);
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(server.publicId || server.id);
      onNotice(messages.serverIdCopied ?? 'Sunucu ID\'si kopyalandı.');
      setIsOpen(false);
    } catch {
      onNotice(messages.genericError);
    }
  }

  return (
    <div className="server-header-wrapper" ref={containerRef}>
      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
        <div className="server-header-bar">
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={`server-header-trigger${isOpen ? ' is-active' : ''}`}
              aria-label={server.name}
            >
              <strong className="server-header-title">{server.name}</strong>
              <ChevronDown
                size={18}
                className={`server-header-chevron${isOpen ? ' is-rotated' : ''}`}
                aria-hidden="true"
              />
            </button>
          </DropdownMenu.Trigger>

          {canInvite && (
            <button
              type="button"
              className="icon-button server-header-quick-invite"
              title={messages.invitePeople ?? (locale === 'tr' ? 'Sunucuya Davet Et' : 'Invite to Server')}
              aria-label={messages.invitePeople ?? (locale === 'tr' ? 'Sunucuya Davet Et' : 'Invite to Server')}
              onClick={(event) => {
                event.stopPropagation();
                onInvite();
              }}
            >
              <UserPlus size={17} />
            </button>
          )}
        </div>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="server-header-dropdown"
            align="start"
            side="bottom"
            sideOffset={6}
            style={{
              width: containerRef.current
                ? `${Math.max(220, containerRef.current.offsetWidth - 16)}px`
                : '240px',
            }}
          >
            <DropdownMenu.Item asChild>
              <button
                type="button"
                className="server-menu-item server-menu-boost"
                onClick={() => {
                  setIsOpen(false);
                  onOpenWoost();
                }}
              >
                <span>
                  <Sparkles size={16} className="server-menu-icon-boost" />
                  {messages.serverBoostMenu ?? (locale === 'tr' ? 'Woost Bas' : 'Woost Server')}
                </span>
              </button>
            </DropdownMenu.Item>

            <DropdownMenu.Item asChild>
              <button
                type="button"
                className="server-menu-item"
                onClick={() => {
                  setIsOpen(false);
                  if (server.tag) {
                    setTagDialogOpen(true);
                  } else {
                    onOpenTags();
                  }
                }}
              >
                <span>
                  <Waves size={16} />
                  {messages.serverTagMenu ?? (locale === 'tr' ? 'Sunucu Etiketi' : 'Server Tag')}
                </span>
              </button>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="server-menu-divider" />

            {canInvite && (
              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  className="server-menu-item server-menu-accent"
                  onClick={() => {
                    setIsOpen(false);
                    onInvite();
                  }}
                >
                  <span>
                    <UserPlus size={16} />
                    {messages.inviteToServer ??
                      (locale === 'tr' ? 'Sunucuya Davet Et' : 'Invite to Server')}
                  </span>
                </button>
              </DropdownMenu.Item>
            )}

            {canAccessSettings && (
              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  className="server-menu-item"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings('overview');
                  }}
                >
                  <span>
                    <Settings size={16} />
                    {messages.serverSettings}
                  </span>
                </button>
              </DropdownMenu.Item>
            )}

            {canManageChannels && (
              <>
                <DropdownMenu.Item asChild>
                  <button
                    type="button"
                    className="server-menu-item"
                    onClick={() => {
                      setIsOpen(false);
                      onCreateChannel();
                    }}
                  >
                    <span>
                      <PlusCircle size={16} />
                      {messages.createChannel}
                    </span>
                  </button>
                </DropdownMenu.Item>

                <DropdownMenu.Item asChild>
                  <button
                    type="button"
                    className="server-menu-item"
                    onClick={() => {
                      setIsOpen(false);
                      onCreateCategory();
                    }}
                  >
                    <span>
                      <FolderPlus size={16} />
                      {messages.createCategory}
                    </span>
                  </button>
                </DropdownMenu.Item>
              </>
            )}

            <DropdownMenu.Separator className="server-menu-divider" />

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger asChild>
                <button
                  type="button"
                  className="server-menu-item"
                >
                  <span>
                    <Bell size={16} />
                    {messages.notificationSettings ??
                      (locale === 'tr' ? 'Bildirim Ayarları' : 'Notification Settings')}
                  </span>
                  <ChevronRight size={14} className="server-menu-chevron" />
                </button>
              </DropdownMenu.SubTrigger>

              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className="server-header-submenu"
                  sideOffset={6}
                >
                  <DropdownMenu.Item asChild>
                    <button
                      type="button"
                      className={`server-menu-item${currentLevel === 'ALL_MESSAGES' ? ' is-selected' : ''}`}
                      onClick={() => void updateNotificationLevel('ALL_MESSAGES')}
                    >
                      <span>{messages.notificationAllMessages}</span>
                      {currentLevel === 'ALL_MESSAGES' && <Check size={14} />}
                    </button>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <button
                      type="button"
                      className={`server-menu-item${currentLevel === 'MENTIONS_ONLY' ? ' is-selected' : ''}`}
                      onClick={() => void updateNotificationLevel('MENTIONS_ONLY')}
                    >
                      <span>{messages.notificationMentionsOnly}</span>
                      {currentLevel === 'MENTIONS_ONLY' && <Check size={14} />}
                    </button>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <button
                      type="button"
                      className={`server-menu-item${currentLevel === 'NOTHING' ? ' is-selected' : ''}`}
                      onClick={() => void updateNotificationLevel('NOTHING')}
                    >
                      <span>{messages.notificationNothing}</span>
                      {currentLevel === 'NOTHING' && <Check size={14} />}
                    </button>
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Separator className="server-menu-divider" />

            {server.role !== 'OWNER' && (
              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  className="server-menu-item server-menu-danger"
                  onClick={() => {
                    setIsOpen(false);
                    setLeaveDialogOpen(true);
                  }}
                >
                  <span>
                    <LogOut size={16} />
                    {messages.leaveServer}
                  </span>
                </button>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item asChild>
              <button
                type="button"
                className="server-menu-item"
                onClick={() => void copyId()}
              >
                <span>
                  <Copy size={16} />
                  {messages.copyServerId}
                </span>
              </button>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {server.role !== 'OWNER' && (
        <Dialog.Root open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-card server-leave-dialog">
              <Dialog.Title>{messages.leaveServer}</Dialog.Title>
              <Dialog.Description>
                {locale === 'tr'
                  ? `"${server.name}" sunucusundan ayrılmak istediğine emin misin?`
                  : `Are you sure you want to leave "${server.name}"?`}
              </Dialog.Description>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="dialog-button"
                  onClick={() => setLeaveDialogOpen(false)}
                >
                  {messages.cancel}
                </button>
                <button
                  type="button"
                  className="dialog-button danger"
                  disabled={leaving}
                  onClick={() => void (async () => {
                    setLeaving(true);
                    try {
                      await onLeave();
                      setLeaveDialogOpen(false);
                    } catch {
                      onNotice(messages.genericError);
                    } finally {
                      setLeaving(false);
                    }
                  })()}
                >
                  {leaving ? (locale === 'tr' ? 'Ayrılınıyor...' : 'Leaving...') : messages.leaveServer}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {server.tag && (
        <Dialog.Root open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-card server-tag-use-dialog">
              <Dialog.Close asChild>
                <button type="button" className="server-tag-use-close" aria-label="Close">
                  <X size={20} />
                </button>
              </Dialog.Close>
              <Dialog.Title className="server-tag-use-title">
                {locale === 'tr'
                  ? 'Bu sunucunun etiketini kullan'
                  : "Use this server's tag"}
              </Dialog.Title>
              <Dialog.Description className="server-tag-use-desc">
                {locale === 'tr'
                  ? "Wapve'de gittiğin her yerde favori sunucunu temsil et."
                  : 'Represent your favorite server everywhere on Wapve.'}
              </Dialog.Description>
              <div className="server-tag-use-preview">
                <span className="server-tag-use-icon">
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" />
                  ) : (
                    server.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <strong>{server.name}</strong>
                <ServerTagChip tag={server.tag} interactive={false} />
              </div>
              <div className="server-tag-use-actions">
                <button
                  type="button"
                  className={`server-tag-use-btn primary${server.tagSelectedByMe ? ' active' : ''}`}
                  disabled={tagBusy}
                  onClick={() => void (async () => {
                    setTagBusy(true);
                    try {
                      await apiRequest(`/servers/${server.id}/tag/me`, {
                        method: 'PATCH',
                        body: JSON.stringify({ enabled: !server.tagSelectedByMe }),
                      });
                      onNotice(
                        server.tagSelectedByMe
                          ? locale === 'tr'
                            ? 'Sunucu etiketi profilinden kaldırıldı.'
                            : 'Server tag removed from your profile.'
                          : locale === 'tr'
                            ? 'Sunucu etiketi profiline eklendi.'
                            : 'Server tag added to your profile.',
                      );
                      await queryClient.invalidateQueries({ queryKey: ['servers'] });
                      setTagDialogOpen(false);
                    } catch {
                      onNotice(messages.genericError);
                    } finally {
                      setTagBusy(false);
                    }
                  })()}
                >
                  {server.tagSelectedByMe
                    ? locale === 'tr'
                      ? 'Etiketi Kaldır'
                      : 'Remove Tag'
                    : locale === 'tr'
                      ? 'Etiketi Kullan'
                      : 'Use Tag'}
                </button>
                <button
                  type="button"
                  className="server-tag-use-btn secondary"
                  onClick={() => {
                    setTagDialogOpen(false);
                    onEditProfile();
                  }}
                >
                  {messages.editProfile ?? (locale === 'tr' ? 'Profili Düzenle' : 'Edit Profile')}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
