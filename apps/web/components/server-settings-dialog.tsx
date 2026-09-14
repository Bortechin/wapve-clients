'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { serverInviteUrl } from '@wapve/contracts';
import { Button } from '@wapve/ui';
import type {
  ChannelTree,
  Locale,
  ServerInvite,
  ServerMember,
  ServerSummary,
} from '@wapve/contracts';
import {
  Activity,
  Ban,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  Gem,
  Headphones,
  ImagePlus,
  Link2,
  Radio,
  RotateCcw,
  Save,
  SmilePlus,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import {
  ProfileMediaCameraIcon,
  ProfileMediaEditor,
  type ProfileMediaKind,
} from './profile-media-editor';
import { ServerModerationPanel, type ServerModerationSection } from './server-moderation-dialog';
import { ServerEmojiSettings } from './server-emoji-settings';
import { ServerInsightsPanel } from './server-insights-panel';
import { ServerSupportOverviewPanel } from './server-support-panel';
import { ServerSoundboardSettings } from './server-soundboard-settings';
import { ServerTagSettings } from './server-tag-settings';

export type ServerSettingsSection =
  | 'overview'
  | 'supports'
  | 'tags'
  | 'invites'
  | 'emojis'
  | 'soundboard'
  | 'insights'
  | ServerModerationSection;

type ServerOverviewDraft = {
  name: string;
  description: string;
  discoveryEnabled: boolean;
  afkChannelId: string;
  afkTimeoutSeconds: number;
  customInviteSlug: string;
};

const emptyServerDraft: ServerOverviewDraft = {
  name: '',
  description: '',
  discoveryEnabled: false,
  afkChannelId: '',
  afkTimeoutSeconds: 300,
  customInviteSlug: '',
};

function draftFromServer(server: ServerSummary | null): ServerOverviewDraft {
  if (!server) return emptyServerDraft;
  return {
    name: server.name,
    description: server.description ?? '',
    discoveryEnabled: server.discoveryEnabled,
    afkChannelId: server.afkChannelId ?? '',
    afkTimeoutSeconds: server.afkTimeoutSeconds,
    customInviteSlug: server.customInviteSlug ?? '',
  };
}

function useAnimatedPresence(visible: boolean, exitDuration = 320) {
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (visible) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      timeout = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, exitDuration);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [exitDuration, mounted, visible]);

  return { mounted, leaving };
}

export function ServerSettingsDialog({
  open,
  onOpenChange,
  initialSection,
  messages,
  locale,
  server,
  members,
  currentUserId,
  twoFactorEnabled,
  onUpdated,
  onRemoved,
  onMembersChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection: ServerSettingsSection;
  messages: Dictionary;
  locale: Locale;
  server: ServerSummary | null;
  members: ServerMember[];
  currentUserId: string;
  twoFactorEnabled: boolean;
  onUpdated: (server: ServerSummary, notice?: string) => void;
  onRemoved: (serverId: string) => void;
  onMembersChanged: () => Promise<unknown>;
}) {
  const [section, setSection] = useState<ServerSettingsSection>(initialSection);
  const [mediaEditorKind, setMediaEditorKind] = useState<ProfileMediaKind | null>(null);
  const [serverDraft, setServerDraft] = useState<ServerOverviewDraft>(() =>
    draftFromServer(server),
  );
  const [serverBaseline, setServerBaseline] = useState<ServerOverviewDraft>(() =>
    draftFromServer(server),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invite, setInvite] = useState<ServerInvite | null>(null);
  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [voiceChannels, setVoiceChannels] = useState<ChannelTree['channels']>([]);
  const [copied, setCopied] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteExpiresIn, setInviteExpiresIn] = useState(24);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const canAccessSettings = Boolean(
    server?.role === 'OWNER' ||
      server?.permissions.some((perm) =>
        [
          'MANAGE_SERVER',
          'MANAGE_ROLES',
          'MANAGE_CHANNELS',
          'BAN_MEMBERS',
          'KICK_MEMBERS',
          'MANAGE_AUTOMOD',
          'VIEW_AUDIT_LOG',
          'MANAGE_EXPRESSIONS',
        ].includes(perm),
      ),
  );
  const canManageServer = Boolean(
    server?.role === 'OWNER' || server?.permissions.includes('MANAGE_SERVER'),
  );
  const canCreateInvites = Boolean(
    server?.role === 'OWNER' || server?.permissions.includes('CREATE_INVITES'),
  );
  const canManageExpressions = Boolean(
    server?.role === 'OWNER' || server?.permissions.includes('MANAGE_EXPRESSIONS'),
  );
  const serverDirty =
    serverDraft.name !== serverBaseline.name ||
    serverDraft.description !== serverBaseline.description ||
    serverDraft.discoveryEnabled !== serverBaseline.discoveryEnabled ||
    serverDraft.afkChannelId !== serverBaseline.afkChannelId ||
    serverDraft.afkTimeoutSeconds !== serverBaseline.afkTimeoutSeconds ||
    serverDraft.customInviteSlug !== serverBaseline.customInviteSlug;
  const saveDockPresence = useAnimatedPresence(
    open && section === 'overview' && canManageServer && serverDirty,
  );

  useEffect(() => {
    if (open) {
      setSection(initialSection);
      const nextDraft = draftFromServer(server);
      setServerDraft(nextDraft);
      setServerBaseline(nextDraft);
    }
    if (!open) {
      setError('');
      setNotice('');
      setInvite(null);
      setCopied(false);
      setConfirmDelete(false);
      setDeletePassword('');
      setDeleteCode('');
      setMediaEditorKind(null);
    }
  }, [open, initialSection, server?.id]);

  useEffect(() => {
    if (!open || !server) return;
    if (canManageServer) {
      void apiRequest<ChannelTree>(`/servers/${server.id}/channels`)
        .then((tree) =>
          setVoiceChannels(tree.channels.filter((channel) => channel.type === 'VOICE')),
        )
        .catch(() => setVoiceChannels([]));
    }
    if (section === 'invites' && canCreateInvites) void loadInvites();
  }, [open, section, server?.id]);

  if (!server) return null;
  const activeServer = server;
  const owner = activeServer.role === 'OWNER';
  const initial = activeServer.name.slice(0, 2).toUpperCase();
  const sectionTitleMap = {
    overview: messages.serverOverview,
    supports: 'Woost',
    tags: 'Sunucu Etiketi',
    invites: messages.invites,
    emojis: messages.serverEmojis,
    soundboard: locale === 'tr' ? 'Ses Tahtası' : 'Soundboard',
    insights: messages.serverInsights,
    members: messages.members,
    roles: messages.roles,
    bans: messages.bans,
    automod: 'Wapve Guard',
    audit: messages.auditLog,
  };
  const sectionTitle =
    sectionTitleMap[section as keyof typeof sectionTitleMap] ??
    (locale === 'tr' ? 'Ses Tahtası' : 'Soundboard');
  const sectionDescription =
    section === 'supports'
      ? 'Woost seviyelerini, açılan ses ve emoji avantajlarını yönet.'
      : section === 'tags'
        ? 'Sunucunun dört karakterlik kimliğini yönet veya profilinde kullan.'
      : section === 'soundboard'
        ? 'Sunucudaki herkes için ses tahtası seslerini yükle ve yönet.'
        : messages.serverSettingsDescriptions[section];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<ServerSummary>(`/servers/${activeServer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: serverDraft.name,
          description: serverDraft.description.trim() || null,
          discoveryEnabled: serverDraft.discoveryEnabled,
          afkChannelId: serverDraft.afkChannelId || null,
          afkTimeoutSeconds: serverDraft.afkTimeoutSeconds,
          customInviteSlug: serverDraft.customInviteSlug.trim() || null,
        }),
      });
      const nextDraft = draftFromServer(updated);
      setServerDraft(nextDraft);
      setServerBaseline(nextDraft);
      onUpdated(updated, messages.serverUpdated);
      setNotice(messages.serverUpdated);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function uploadIcon(file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const body = new FormData();
    body.append('icon', file);
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<ServerSummary>(`/servers/${activeServer.id}/icon`, {
        method: 'POST',
        body,
      });
      onUpdated({
        ...updated,
        iconUrl: updated.iconUrl ? `${updated.iconUrl}?v=${Date.now()}` : null,
      });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeIcon(): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/icon`, { method: 'DELETE' });
      onUpdated({ ...activeServer, iconUrl: null });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadBanner(file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const body = new FormData();
    body.append('banner', file);
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<ServerSummary>(`/servers/${activeServer.id}/banner`, {
        method: 'POST',
        body,
      });
      onUpdated({
        ...updated,
        bannerUrl: updated.bannerUrl ? `${updated.bannerUrl}?v=${Date.now()}` : null,
      });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner(): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/banner`, { method: 'DELETE' });
      onUpdated({ ...activeServer, bannerUrl: null });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const created = await apiRequest<ServerInvite>(`/servers/${activeServer.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ maxUses: inviteMaxUses, expiresInHours: inviteExpiresIn }),
      });
      setInvite(created);
      setInvites((current) => [created, ...current]);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function loadInvites() {
    if (!server) return;
    try {
      setInvites(await apiRequest<ServerInvite[]>(`/servers/${server.id}/invites`));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/invites/${inviteId}`, { method: 'DELETE' });
      setInvites((current) =>
        current.map((item) =>
          item.id === inviteId ? { ...item, revokedAt: new Date().toISOString() } : item,
        ),
      );
      if (invite?.id === inviteId) setInvite(null);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!invite) return;
    await navigator.clipboard.writeText(serverInviteUrl(invite.code));
    setCopied(true);
  }

  async function leave() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/actions/leave`, { method: 'POST', body: '{}' });
      onRemoved(activeServer.id);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function removeServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          currentPassword: deletePassword,
          ...(twoFactorEnabled ? { code: deleteCode } : {}),
        }),
      });
      onRemoved(activeServer.id);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  if (!server || !canAccessSettings) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay server-settings-overlay" />
        <Dialog.Content
          className="settings-dialog server-settings-dialog"
          aria-describedby="server-settings-description"
        >
          <aside className="settings-nav server-settings-nav">
            <span className="server-nav-current" aria-hidden="true" />
            <div className="server-settings-brand">
              <div className="server-avatar">
                {activeServer.iconUrl ? <img src={activeServer.iconUrl} alt="" /> : initial}
              </div>
              <div>
                <span className="server-brand-kicker">SERVER STUDIO</span>
                <h2>{activeServer.name}</h2>
                <small>{messages.serverControlCenter}</small>
              </div>
            </div>
            <label className="settings-mobile-picker">
              <span>{locale === 'tr' ? 'Sunucu ayarı' : 'Server setting'}</span>
              <select
                aria-label={locale === 'tr' ? 'Sunucu ayarı' : 'Server setting'}
                value={section}
                onChange={(event) => setSection(event.target.value as ServerSettingsSection)}
              >
                <option value="overview">{messages.serverOverview}</option>
                <option value="supports">Woost</option>
                <option value="tags">{locale === 'tr' ? 'Sunucu Etiketi' : 'Server Tag'}</option>
                {canCreateInvites && <option value="invites">{messages.invites}</option>}
                {canManageExpressions && <option value="emojis">{messages.serverEmojis}</option>}
                {canManageExpressions && (
                  <option value="soundboard">{locale === 'tr' ? 'Ses Tahtası' : 'Soundboard'}</option>
                )}
                {canManageServer && <option value="insights">{messages.serverInsights}</option>}
                <option value="members">{messages.members}</option>
                <option value="roles">{messages.roles}</option>
                {activeServer.permissions.includes('BAN_MEMBERS') && (
                  <option value="bans">{messages.bans}</option>
                )}
                {activeServer.permissions.includes('MANAGE_AUTOMOD') && (
                  <option value="automod">Wapve Guard</option>
                )}
                {activeServer.permissions.includes('VIEW_AUDIT_LOG') && (
                  <option value="audit">{messages.auditLog}</option>
                )}
              </select>
            </label>
            <span className="settings-nav-label">{messages.server}</span>
            <button
              className={section === 'overview' ? 'active' : ''}
              onClick={() => setSection('overview')}
            >
              <Server size={17} /> {messages.serverOverview}
            </button>
            <button
              className={section === 'supports' ? 'active' : ''}
              onClick={() => setSection('supports')}
            >
              <img className="woost-icon" src="/brand/woost-icon.png" width="20" height="20" alt="" /> Woost
            </button>
            <button className={section === 'tags' ? 'active' : ''} onClick={() => setSection('tags')}>
              <Waves size={17} /> Sunucu Etiketi
            </button>
            {canCreateInvites && (
              <button
                className={section === 'invites' ? 'active' : ''}
                onClick={() => setSection('invites')}
              >
                <Link2 size={17} /> {messages.invites}
              </button>
            )}
            {canManageExpressions && (
              <button
                className={section === 'emojis' ? 'active' : ''}
                onClick={() => setSection('emojis')}
              >
                <SmilePlus size={17} /> {messages.serverEmojis}
              </button>
            )}
            {canManageExpressions && (
              <button
                className={section === 'soundboard' ? 'active' : ''}
                onClick={() => setSection('soundboard')}
              >
                <Headphones size={17} /> {locale === 'tr' ? 'Ses Tahtası' : 'Soundboard'}
              </button>
            )}
            {canManageServer && (
              <button
                className={section === 'insights' ? 'active' : ''}
                onClick={() => setSection('insights')}
              >
                <BarChart3 size={17} /> {messages.serverInsights}
              </button>
            )}
            <span className="settings-nav-label">{messages.people}</span>
            <button
              className={section === 'members' ? 'active' : ''}
              onClick={() => setSection('members')}
            >
              <Users size={17} /> {messages.members}
            </button>
            <button
              className={section === 'roles' ? 'active' : ''}
              onClick={() => setSection('roles')}
            >
              <Shield size={17} /> {messages.roles}
            </button>
            {activeServer.permissions.some((permission) =>
              ['BAN_MEMBERS', 'MANAGE_AUTOMOD', 'VIEW_AUDIT_LOG'].includes(permission),
            ) && (
              <>
                <span className="settings-nav-label">{messages.moderation}</span>
                {activeServer.permissions.includes('BAN_MEMBERS') && (
                  <button
                    className={section === 'bans' ? 'active' : ''}
                    onClick={() => setSection('bans')}
                  >
                    <Ban size={17} /> {messages.bans}
                  </button>
                )}
                {activeServer.permissions.includes('MANAGE_AUTOMOD') && (
                  <button
                    className={section === 'automod' ? 'active' : ''}
                    onClick={() => setSection('automod')}
                  >
                    <ShieldAlert size={17} /> Wapve Guard
                  </button>
                )}
                {activeServer.permissions.includes('VIEW_AUDIT_LOG') && (
                  <button
                    className={section === 'audit' ? 'active' : ''}
                    onClick={() => setSection('audit')}
                  >
                    <ScrollText size={17} /> {messages.auditLog}
                  </button>
                )}
              </>
            )}
            <div className="server-nav-status">
              <span className="server-nav-status-icon">
                <Activity size={15} />
              </span>
              <span>
                <strong>{messages.serverControlCenter}</strong>
                <small>
                  <i /> {members.length} {messages.members.toLocaleLowerCase()}
                </small>
              </span>
            </div>
          </aside>
          <section className="settings-content server-settings-content">
            <div className="server-settings-ambient" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <Dialog.Close asChild>
              <button className="server-settings-close" aria-label={messages.close}>
                <X size={22} />
                <small>ESC</small>
              </button>
            </Dialog.Close>
            <div className="settings-inner server-settings-inner">
              <header className="settings-title server-settings-hero">
                <div className="server-settings-hero-copy">
                  <span className="settings-eyebrow">
                    <Waves size={13} /> WAPVE / {messages.serverSettings}
                  </span>
                  <Dialog.Title asChild>
                    <h2>{sectionTitle}</h2>
                  </Dialog.Title>
                  <Dialog.Description id="server-settings-description">
                    {sectionDescription}
                  </Dialog.Description>
                </div>
                <div className="server-settings-hero-stats" aria-label={messages.server}>
                  <span>
                    <Users size={15} />
                    <strong>{members.length}</strong>
                    <small>{messages.members}</small>
                  </span>
                  <span>
                    <Radio size={15} />
                    <strong>{voiceChannels.length}</strong>
                    <small>{messages.channel}</small>
                  </span>
                  <span className="server-access-pill">
                    {owner ? <Crown size={15} /> : <Shield size={15} />}
                    <strong>{activeServer.role}</strong>
                  </span>
                </div>
              </header>
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

              {section === 'overview' && (
                <div className="server-overview-layout">
                  {canManageServer && (
                    <form
                      id="server-overview-form"
                      className="server-overview-main"
                      onSubmit={(event) => void save(event)}
                    >
                      <section className="settings-section server-settings-card server-profile-card">
                        <header className="server-card-heading">
                          <span>
                            <Sparkles size={18} />
                          </span>
                          <div>
                            <h3>{messages.serverProfile}</h3>
                            <p>{messages.serverSettingsDescriptions.overview}</p>
                          </div>
                          <span className="server-card-badge">
                            <CheckCircle2 size={13} /> LIVE
                          </span>
                        </header>
                        <div className="field">
                          <label htmlFor="edit-server-name">{messages.serverName}</label>
                          <input
                            id="edit-server-name"
                            name="name"
                            value={serverDraft.name}
                            onChange={(event) =>
                              setServerDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            minLength={2}
                            maxLength={100}
                            required
                          />
                        </div>
                        <label className="field" htmlFor="edit-server-description">
                          <span>{messages.serverDescription}</span>
                          <textarea
                            id="edit-server-description"
                            name="description"
                            value={serverDraft.description}
                            onChange={(event) =>
                              setServerDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            maxLength={300}
                            rows={4}
                            placeholder={messages.serverDescriptionPlaceholder}
                          />
                          <small className="field-hint">{messages.serverDescriptionHint}</small>
                        </label>
                      </section>
                      <section className="settings-section server-settings-card server-discovery-settings-card">
                        <header className="server-card-heading">
                          <span>
                            <Sparkles size={18} />
                          </span>
                          <div>
                            <h3>{messages.serverDiscovery}</h3>
                            <p>{messages.serverDiscoveryHint}</p>
                          </div>
                          <label
                            className="settings-toggle server-discovery-toggle"
                            aria-label={messages.serverDiscovery}
                          >
                            <input
                              type="checkbox"
                              checked={serverDraft.discoveryEnabled}
                              onChange={(event) =>
                                setServerDraft((current) => ({
                                  ...current,
                                  discoveryEnabled: event.target.checked,
                                }))
                              }
                            />
                            <span aria-hidden="true" />
                          </label>
                        </header>
                        <p className="server-discovery-status">
                          {serverDraft.discoveryEnabled
                            ? messages.serverDiscoveryEnabled
                            : messages.serverDiscoveryDisabled}
                        </p>
                      </section>
                      <section
                        className={`settings-section server-settings-card server-custom-url-card${activeServer.supportLevel < 3 ? ' is-locked' : ''}`}
                      >
                        <header className="server-card-heading">
                          <span>
                            <Link2 size={18} />
                          </span>
                          <div>
                            <h3>Özel davet URL'si</h3>
                            <p>
                              3. seviye takviyede sunucuna kısa ve akılda kalıcı bir bağlantı ver.
                            </p>
                          </div>
                          <span className="server-card-badge">Seviye 3</span>
                        </header>
                        {activeServer.supportLevel >= 3 ? (
                          <div className="custom-url-editor">
                            <div className="custom-url-input-wrap">
                              <span>wapve.cc/</span>
                              <input
                                name="customInviteSlug"
                                value={serverDraft.customInviteSlug}
                                onChange={(event) =>
                                  setServerDraft((current) => ({
                                    ...current,
                                    customInviteSlug: event.target.value
                                      .toLowerCase()
                                      .replace(/[^a-z0-9-]/g, ''),
                                  }))
                                }
                                minLength={6}
                                maxLength={32}
                                pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                                placeholder="testsunucu"
                              />
                            </div>
                            {serverDraft.customInviteSlug && (
                              <div className="custom-url-actions">
                                <code>{serverInviteUrl(serverDraft.customInviteSlug)}</code>
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(
                                      serverInviteUrl(serverDraft.customInviteSlug),
                                    );
                                    setCopied(true);
                                  }}
                                  aria-label="Bağlantıyı kopyala"
                                >
                                  <Copy size={15} />
                                </button>
                              </div>
                            )}
                            <small className="field-hint">
                              Bu bağlantıyı paylaşan herkes doğrudan sunucunun katılım ekranına
                              yönlendirilir.
                            </small>
                          </div>
                        ) : (
                          <div className="custom-url-locked">
                            <Gem size={17} /> Özel URL için {3 - activeServer.supportLevel} seviye
                            daha takviye gerekli.
                          </div>
                        )}
                      </section>
                      <section className="settings-section server-settings-card server-afk-card">
                        <header className="server-card-heading">
                          <span>
                            <Radio size={18} />
                          </span>
                          <div>
                            <h3>{messages.afkChannel}</h3>
                            <p>{messages.afkChannelHint}</p>
                          </div>
                        </header>
                        <div className="afk-settings-grid">
                          <label className="field">
                            <span>{messages.afkChannel}</span>
                            <select
                              name="afkChannelId"
                              value={serverDraft.afkChannelId}
                              onChange={(event) =>
                                setServerDraft((current) => ({
                                  ...current,
                                  afkChannelId: event.target.value,
                                }))
                              }
                            >
                              <option value="">{messages.noAfkChannel}</option>
                              {voiceChannels.map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                  {channel.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>
                              <Clock3 size={13} /> {messages.afkTimeout}
                            </span>
                            <select
                              name="afkTimeoutSeconds"
                              value={serverDraft.afkTimeoutSeconds}
                              onChange={(event) =>
                                setServerDraft((current) => ({
                                  ...current,
                                  afkTimeoutSeconds: Number(event.target.value),
                                }))
                              }
                            >
                              <option value="60">1 {messages.minute}</option>
                              <option value="300">5 {messages.minutes}</option>
                              <option value="900">15 {messages.minutes}</option>
                              <option value="1800">30 {messages.minutes}</option>
                              <option value="3600">60 {messages.minutes}</option>
                            </select>
                          </label>
                        </div>
                      </section>
                    </form>
                  )}
                  {canManageServer && (
                    <aside className="settings-section server-settings-card server-identity-card">
                      <header className="server-card-heading">
                        <span>
                          <ImagePlus size={18} />
                        </span>
                        <div>
                          <h3>{messages.serverIcon}</h3>
                          <p>{messages.serverImageHint}</p>
                        </div>
                      </header>
                      <div className="server-identity-preview">
                        <button
                          type="button"
                          className="server-banner-preview server-identity-banner-trigger"
                          onClick={() => setMediaEditorKind('banner')}
                          disabled={busy}
                          aria-label={messages.changeServerBanner}
                        >
                          {activeServer.bannerUrl ? (
                            <img src={activeServer.bannerUrl} alt="" />
                          ) : (
                            <span>
                              <Waves size={28} /> {messages.noServerBanner}
                            </span>
                          )}
                          <span className="account-media-camera">
                            <ProfileMediaCameraIcon />
                          </span>
                        </button>
                        <button
                          type="button"
                          className="server-avatar server-avatar--large server-identity-avatar-trigger"
                          onClick={() => setMediaEditorKind('avatar')}
                          disabled={busy}
                          aria-label={messages.changeServerIcon}
                        >
                          {activeServer.iconUrl ? (
                            <img src={activeServer.iconUrl} alt="" />
                          ) : (
                            initial
                          )}
                          <span className="account-media-camera">
                            <ProfileMediaCameraIcon />
                          </span>
                        </button>
                        <div className="server-identity-copy">
                          <strong>{serverDraft.name || activeServer.name}</strong>
                          <small>{messages.serverControlCenter}</small>
                        </div>
                      </div>
                    </aside>
                  )}
                  <section className="settings-section danger-zone">
                    <div>
                      <span className="danger-zone-icon">
                        <Trash2 size={18} />
                      </span>
                      <span>
                        <h3>{owner ? messages.deleteServer : messages.leaveServer}</h3>
                        <p>{owner ? messages.serverDangerHint : activeServer.name}</p>
                      </span>
                    </div>
                    {owner ? (
                      confirmDelete ? (
                        <form
                          className="form-stack server-delete-form"
                          onSubmit={(event) => void removeServer(event)}
                        >
                          <label className="field">
                            <span>{messages.currentPassword}</span>
                            <input
                              type="password"
                              autoComplete="current-password"
                              value={deletePassword}
                              onChange={(event) => setDeletePassword(event.target.value)}
                              required
                            />
                          </label>
                          {twoFactorEnabled && (
                            <label className="field">
                              <span>{messages.twoFactorCode}</span>
                              <input
                                autoComplete="one-time-code"
                                value={deleteCode}
                                onChange={(event) => setDeleteCode(event.target.value.slice(0, 32))}
                                minLength={6}
                                maxLength={32}
                                required
                              />
                            </label>
                          )}
                          <Button type="submit" variant="danger" disabled={busy}>
                            <Trash2 size={16} /> {messages.confirmDeleteServer}
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => setConfirmDelete(true)}
                          disabled={busy}
                        >
                          <Trash2 size={16} /> {messages.deleteServer}
                        </Button>
                      )
                    ) : (
                      <Button variant="danger" onClick={() => void leave()} disabled={busy}>
                        <Trash2 size={16} /> {messages.leaveServer}
                      </Button>
                    )}
                  </section>
                </div>
              )}

              {section === 'invites' && canCreateInvites && (
                <section className="settings-section invite-management server-invite-studio">
                  <div className="invite-builder-head">
                    <div className="invite-builder-icon">
                      <Link2 size={22} />
                    </div>
                    <div>
                      <h3>{messages.inviteLink}</h3>
                      <p className="field-hint">{messages.invitesHint}</p>
                    </div>
                  </div>
                  {invite ? (
                    <>
                      <p className="field-hint">{messages.inviteCreated}</p>
                      <div className="invite-code">
                        <code>{serverInviteUrl(invite.code)}</code>
                        <button
                          className="icon-button"
                          onClick={() => void copyInvite()}
                          aria-label={messages.copy}
                        >
                          <Copy size={17} />
                        </button>
                      </div>
                      {copied && (
                        <div className="form-success" role="status">
                          {messages.copied}
                        </div>
                      )}
                      <div className="invite-summary">
                        <span>
                          {messages.inviteMaxUses}: <strong>{invite.maxUses}</strong>
                        </span>
                        <span>
                          {messages.inviteExpires}:{' '}
                          <strong>{new Date(invite.expiresAt).toLocaleString()}</strong>
                        </span>
                      </div>
                      <Button variant="secondary" onClick={() => setInvite(null)}>
                        {messages.createAnotherInvite}
                      </Button>
                    </>
                  ) : (
                    <div className="invite-options">
                      <label className="field">
                        <span>{messages.inviteExpiresIn}</span>
                        <select
                          value={inviteExpiresIn}
                          onChange={(event) => setInviteExpiresIn(Number(event.target.value))}
                        >
                          <option value={1}>1 {messages.hour}</option>
                          <option value={6}>6 {messages.hours}</option>
                          <option value={24}>1 {messages.day}</option>
                          <option value={72}>3 {messages.days}</option>
                          <option value={168}>7 {messages.days}</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>{messages.inviteMaxUses}</span>
                        <select
                          value={inviteMaxUses}
                          onChange={(event) => setInviteMaxUses(Number(event.target.value))}
                        >
                          <option value={1}>1</option>
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </label>
                      <Button onClick={() => void createInvite()} disabled={busy}>
                        <Link2 size={16} />
                        {messages.createInvite}
                      </Button>
                    </div>
                  )}
                  <div className="invite-list-heading">
                    <div>
                      <h3>{messages.activeInvites}</h3>
                      <p className="field-hint">{messages.activeInvitesHint}</p>
                    </div>
                    <Button variant="secondary" onClick={() => void loadInvites()} disabled={busy}>
                      {messages.refresh}
                    </Button>
                  </div>
                  <div className="invite-table" role="table" aria-label={messages.activeInvites}>
                    <div className="invite-table-row invite-table-head" role="row">
                      <span>{messages.inviteCreator}</span>
                      <span>{messages.inviteCodeLabel}</span>
                      <span>{messages.inviteUses}</span>
                      <span>{messages.inviteValidity}</span>
                      <span>{messages.channel}</span>
                      <span />
                    </div>
                    {invites.map((item) => {
                      const expired = new Date(item.expiresAt).getTime() <= Date.now();
                      const exhausted = item.usedCount >= item.maxUses;
                      const inactive = Boolean(item.revokedAt || expired || exhausted);
                      return (
                        <div
                          className={`invite-table-row${inactive ? ' inactive' : ''}`}
                          role="row"
                          key={item.id}
                        >
                          <span className="invite-creator-cell">
                            {item.creator.avatarUrl ? (
                              <img src={item.creator.avatarUrl} alt="" />
                            ) : (
                              <i>{item.creator.displayName.slice(0, 1).toUpperCase()}</i>
                            )}
                            <b>{item.creator.displayName}</b>
                          </span>
                          <code>{item.code || messages.legacyInvite}</code>
                          <span>
                            {item.usedCount} / {item.maxUses}
                          </span>
                          <span>
                            {item.revokedAt
                              ? messages.revoked
                              : expired
                                ? messages.expired
                                : exhausted
                                  ? messages.usedUp
                                  : new Date(item.expiresAt).toLocaleString()}
                          </span>
                          <span>
                            {item.channel
                              ? `${item.channel.type === 'VOICE' ? '🔊' : '#'} ${item.channel.name}`
                              : '—'}
                          </span>
                          <button
                            className="icon-button"
                            type="button"
                            disabled={inactive || busy}
                            onClick={() => void revokeInvite(item.id)}
                            aria-label={messages.revokeInvite}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {!invites.length && <p className="invite-table-empty">{messages.noInvites}</p>}
                  </div>
                </section>
              )}

              {section === 'emojis' && canManageExpressions && (
                <ServerEmojiSettings
                  serverId={activeServer.id}
                  messages={messages}
                  limit={
                    activeServer.supportLevel === 3
                      ? 200
                      : activeServer.supportLevel === 2
                        ? 100
                        : activeServer.supportLevel === 1
                          ? 50
                          : 25
                  }
                />
              )}
              {section === 'soundboard' && canManageExpressions && (
                <ServerSoundboardSettings serverId={activeServer.id} messages={messages} />
              )}
              {section === 'supports' && (
                <ServerSupportOverviewPanel server={activeServer} locale={locale} />
              )}
              {section === 'tags' && (
                <ServerTagSettings
                  server={activeServer}
                  locale={locale}
                  canManage={canManageServer}
                  onUpdated={onUpdated}
                />
              )}
              {section === 'insights' && canManageServer && (
                <ServerInsightsPanel
                  serverId={activeServer.id}
                  locale={locale}
                  messages={messages}
                />
              )}

              {(section === 'roles' ||
                section === 'members' ||
                section === 'bans' ||
                section === 'automod' ||
                section === 'audit') && (
                <ServerModerationPanel
                  section={section}
                  server={activeServer}
                  members={members}
                  currentUserId={currentUserId}
                  messages={messages}
                  onMembersChanged={onMembersChanged}
                />
              )}
            </div>
            {saveDockPresence.mounted && (
              <div
                className={`settings-save-dock server-settings-save-dock${saveDockPresence.leaving ? ' is-leaving' : ''}`}
                role="status"
              >
                <span className="settings-save-state">
                  <ShieldCheck size={18} />
                  <span>
                    <strong>
                      {locale === 'tr'
                        ? 'Kaydedilmemiş sunucu değişiklikleri var'
                        : 'You have unsaved server changes'}
                    </strong>
                    <small>
                      {locale === 'tr'
                        ? 'Değişiklikleri uygulamak için kaydet.'
                        : 'Save to apply your changes.'}
                    </small>
                  </span>
                </span>
                <button
                  type="button"
                  className="settings-discard-button"
                  onClick={() => setServerDraft(serverBaseline)}
                  disabled={busy}
                >
                  <RotateCcw size={16} /> {locale === 'tr' ? 'Geri al' : 'Discard'}
                </button>
                <Button type="submit" form="server-overview-form" disabled={busy}>
                  <Save size={16} /> {busy ? messages.saving : messages.save}
                </Button>
              </div>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
      {mediaEditorKind && (
        <ProfileMediaEditor
          kind={mediaEditorKind}
          open
          locale={locale}
          currentUrl={mediaEditorKind === 'avatar' ? activeServer.iconUrl : activeServer.bannerUrl}
          busy={busy}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setMediaEditorKind(null);
          }}
          onApply={(file) => (mediaEditorKind === 'avatar' ? uploadIcon(file) : uploadBanner(file))}
          onRemove={() => (mediaEditorKind === 'avatar' ? removeIcon() : removeBanner())}
        />
      )}
    </Dialog.Root>
  );
}
