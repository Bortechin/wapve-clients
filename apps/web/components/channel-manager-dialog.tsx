'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import type {
  ChannelCategory,
  ChannelPermissionOverrideMap,
  ChannelPermissionSettings,
  ChannelPermissionTargetState,
  ChannelPermissionValue,
  ChannelTree,
  ServerMember,
  ServerChannel,
  ServerRole,
  ServerSummary,
  Locale,
} from '@wapve/contracts';
import {
  Check,
  FolderPlus,
  Hash,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { ChannelTopicEditor } from './channel-topic-editor';
import { EmojiTextInput } from './emoji-text-input';

type SharedProps = {
  messages: Dictionary;
  server: ServerSummary | null;
  tree: ChannelTree;
  onChanged: (notice?: string) => Promise<ChannelTree>;
  locale: Locale;
};

export function ChannelManagerDialog({
  open,
  onOpenChange,
  server,
  messages,
  onChanged,
  locale,
  initialTab = 'channel',
}: SharedProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'channel' | 'category';
}) {
  const [tab, setTab] = useState<'channel' | 'category'>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resourceName, setResourceName] = useState('');

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    } else {
      setError('');
      setResourceName('');
    }
  }, [open, initialTab]);
  if (!server) return null;
  const activeServer = server;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      if (tab === 'channel') {
        await apiRequest(`/servers/${activeServer.id}/channels`, {
          method: 'POST',
          body: JSON.stringify({
            name: resourceName,
            type: data.get('type'),
            nsfw: data.get('nsfw') === 'on',
          }),
        });
        await onChanged(messages.channelCreated);
      } else {
        await apiRequest(`/servers/${activeServer.id}/categories`, {
          method: 'POST',
          body: JSON.stringify({ name: resourceName }),
        });
        await onChanged(messages.categoryCreated);
      }
      form.reset();
      setResourceName('');
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="compact-dialog channel-create-dialog">
          <DialogHeader
            title={messages.channelManagement}
            description={activeServer.name}
            close={messages.close}
          />
          <div className="dialog-tabs">
            <button className={tab === 'channel' ? 'active' : ''} onClick={() => setTab('channel')}>
              <Hash size={16} /> {messages.createChannel}
            </button>
            <button
              className={tab === 'category' ? 'active' : ''}
              onClick={() => setTab('category')}
            >
              <FolderPlus size={16} /> {messages.createCategory}
            </button>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <form className="simple-create-form" onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="create-resource-name">
                {tab === 'channel' ? messages.channelName : messages.categoryName}
              </label>
              {tab === 'channel' ? (
                <EmojiTextInput
                  id="create-resource-name"
                  name="name"
                  value={resourceName}
                  maxLength={50}
                  locale={locale}
                  emojiLabel={messages.addEmoji}
                  required
                  autoFocus
                  onChange={setResourceName}
                />
              ) : (
                <input
                  id="create-resource-name"
                  name="name"
                  value={resourceName}
                  minLength={1}
                  maxLength={100}
                  required
                  autoFocus
                  onChange={(event) => setResourceName(event.target.value)}
                />
              )}
            </div>
            {tab === 'channel' && (
              <>
                <div className="field">
                  <label htmlFor="create-channel-type">{messages.channelType}</label>
                  <select id="create-channel-type" name="type">
                    <option value="TEXT">{messages.textChannel}</option>
                    <option value="VOICE">{messages.voiceChannel}</option>
                  </select>
                </div>
                <div className="field-checkbox" style={{ marginTop: 8 }}>
                  <input id="create-channel-nsfw" type="checkbox" name="nsfw" />
                  <label htmlFor="create-channel-nsfw">NSFW Kanal (Yaş sınırlı içerik)</label>
                </div>
              </>
            )}
            <p className="create-location-hint">
              {tab === 'channel' ? messages.newChannelLocation : messages.categoryCreatedHint}
            </p>
            <Button type="submit" disabled={busy}>
              {tab === 'channel' ? <Plus size={16} /> : <FolderPlus size={16} />}
              {tab === 'channel' ? messages.createChannel : messages.createCategory}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ChannelOverviewDraft = {
  name: string;
  topic: string;
  slowModeSeconds: number;
  categoryId: string;
  nsfw: boolean;
  userLimit: number;
  bitrateKbps: number;
};

function useAnimatedPresence(visible: boolean, exitDuration = 320) {
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, exitDuration);
    return () => window.clearTimeout(timer);
  }, [visible, mounted, exitDuration]);

  return { mounted, leaving };
}

export function ChannelSettingsDialog({
  channel,
  onOpenChange,
  server,
  tree,
  messages,
  onChanged,
  members,
  currentUserId,
  locale,
}: SharedProps & {
  channel: ServerChannel | null;
  members: ServerMember[];
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [overviewDraft, setOverviewDraft] = useState<ChannelOverviewDraft>({
    name: '',
    topic: '',
    slowModeSeconds: 0,
    categoryId: '',
    nsfw: false,
    userLimit: 0,
    bitrateKbps: 64,
  });
  const [overviewBaseline, setOverviewBaseline] = useState<ChannelOverviewDraft>({
    name: '',
    topic: '',
    slowModeSeconds: 0,
    categoryId: '',
    nsfw: false,
    userLimit: 0,
    bitrateKbps: 64,
  });
  const [permissionTargets, setPermissionTargets] = useState<
    Record<string, ChannelPermissionTargetState>
  >({});
  const [baselinePermissionTargets, setBaselinePermissionTargets] = useState<
    Record<string, ChannelPermissionTargetState>
  >({});
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('EVERYONE');
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [dirtyTargets, setDirtyTargets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'overview' | 'permissions'>('overview');
  const initializedChannelIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channel) {
      initializedChannelIdRef.current = null;
      return;
    }
    if (initializedChannelIdRef.current === channel.id) return;
    initializedChannelIdRef.current = channel.id;
    const currentChannel = channel;
    const initialOverview: ChannelOverviewDraft = {
      name: currentChannel.name,
      topic: currentChannel.topic ?? '',
      slowModeSeconds:
        'slowModeSeconds' in currentChannel && typeof currentChannel.slowModeSeconds === 'number'
          ? currentChannel.slowModeSeconds
          : 0,
      categoryId: currentChannel.categoryId ?? '',
      nsfw: currentChannel.nsfw ?? false,
      userLimit: currentChannel.userLimit ?? 0,
      bitrateKbps: currentChannel.bitrateKbps ?? 64,
    };
    setOverviewDraft(initialOverview);
    setOverviewBaseline(initialOverview);
    setPermissionTargets({});
    setBaselinePermissionTargets({});
    setRoles([]);
    setSelectedTargetKey('EVERYONE');
    setPermissionsLoading(true);
    setDirtyTargets([]);
    setError('');
    setConfirmDelete(false);
    setSettingsTab('overview');
    let cancelled = false;
    void Promise.all([
      apiRequest<ChannelPermissionSettings>(
        `/servers/${currentChannel.serverId}/channels/${currentChannel.id}/permissions`,
      ),
      apiRequest<ServerRole[]>(`/servers/${currentChannel.serverId}/roles`),
    ])
      .then(([settings, serverRoles]) => {
        if (cancelled) return;
        const targetsMap = Object.fromEntries(
          settings.targets.map((target) => [targetKey(target), target]),
        );
        setPermissionTargets(targetsMap);
        setBaselinePermissionTargets(targetsMap);
        setRoles(serverRoles);
      })
      .catch((caught) => !cancelled && setError(errorMessage(caught, messages)))
      .finally(() => !cancelled && setPermissionsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [channel, messages]);

  const overviewDirty =
    overviewDraft.name !== overviewBaseline.name ||
    overviewDraft.topic !== overviewBaseline.topic ||
    overviewDraft.slowModeSeconds !== overviewBaseline.slowModeSeconds ||
    overviewDraft.categoryId !== overviewBaseline.categoryId ||
    overviewDraft.nsfw !== overviewBaseline.nsfw ||
    overviewDraft.userLimit !== overviewBaseline.userLimit ||
    overviewDraft.bitrateKbps !== overviewBaseline.bitrateKbps;
  const permissionsDirty = dirtyTargets.length > 0;
  const channelDirty = overviewDirty || permissionsDirty;
  const saveDockPresence = useAnimatedPresence(Boolean(channel) && channelDirty);

  function resetDraft() {
    setOverviewDraft(overviewBaseline);
    setPermissionTargets(baselinePermissionTargets);
    setDirtyTargets([]);
    setError('');
  }

  if (!server || !channel) return null;
  const activeServer = server;
  const activeChannel = channel;
  const bitrateCap =
    activeServer.supportLevel >= 3
      ? 384
      : activeServer.supportLevel === 2
        ? 256
        : activeServer.supportLevel === 1
          ? 128
          : 96;
  const currentMember = members.find((member) => member.id === currentUserId);
  const actorHighestRole = Math.max(
    -1,
    ...(currentMember?.roles.map((role) => role.position) ?? []),
  );
  const editableRoles =
    activeServer.role === 'OWNER'
      ? roles
      : roles.filter((role) => role.position < actorHighestRole);
  const editableMembers = members.filter((member) => {
    if (member.role === 'OWNER' || member.id === currentUserId) return false;
    if (activeServer.role === 'OWNER') return true;
    return Math.max(-1, ...member.roles.map((role) => role.position)) < actorHighestRole;
  });

  async function save() {
    if (!permissionTargets.EVERYONE) return;
    setBusy(true);
    setError('');
    try {
      if (dirtyTargets.length) {
        await apiRequest(`/servers/${activeServer.id}/channels/${activeChannel.id}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify({
            targets: dirtyTargets.map((key) => permissionTargets[key]!),
          }),
        });
      }
      await apiRequest(`/servers/${activeServer.id}/channels/${activeChannel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: overviewDraft.name,
          topic: overviewDraft.topic || null,
          categoryId: overviewDraft.categoryId || null,
          slowModeSeconds: overviewDraft.slowModeSeconds,
          nsfw: overviewDraft.nsfw,
          ...(activeChannel.type === 'VOICE'
            ? {
                userLimit: overviewDraft.userLimit,
                bitrateKbps: overviewDraft.bitrateKbps,
              }
            : {}),
        }),
      });
      setOverviewBaseline(overviewDraft);
      setBaselinePermissionTargets(permissionTargets);
      setDirtyTargets([]);
      await onChanged(messages.channelUpdated);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/channels/${activeChannel.id}`, {
        method: 'DELETE',
      });
      await onChanged();
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={Boolean(channel)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="channel-settings-dialog channel-settings-fullscreen">
          <aside className="channel-settings-nav">
            <div className="channel-settings-channel">
              <span>{channel.type === 'TEXT' ? '#' : '◉'}</span>
              <div>
                <strong>{overviewDraft.name || channel.name}</strong>
                <small>{activeServer.name}</small>
              </div>
            </div>
            <span className="settings-nav-label">{messages.channelSettings}</span>
            <button
              className={settingsTab === 'overview' ? 'active' : ''}
              onClick={() => setSettingsTab('overview')}
            >
              <SlidersHorizontal size={17} />
              {messages.channelOverview}
            </button>
            <button
              className={settingsTab === 'permissions' ? 'active' : ''}
              onClick={() => setSettingsTab('permissions')}
            >
              <ShieldCheck size={17} />
              {messages.channelPermissions}
            </button>
            <div className="channel-settings-nav-spacer" />
            <button className="danger" onClick={() => void remove()} disabled={busy}>
              <Trash2 size={17} />
              {confirmDelete ? messages.confirmDelete : messages.deleteChannel}
            </button>
          </aside>
          <section className="channel-settings-content">
            <Dialog.Close asChild>
              <button className="server-settings-close" aria-label={messages.close}>
                <X size={22} />
                <small>ESC</small>
              </button>
            </Dialog.Close>
            <div className="channel-settings-inner">
              <header className="settings-title">
                <span className="settings-eyebrow">{messages.channelSettings}</span>
                <Dialog.Title>
                  {settingsTab === 'overview'
                    ? messages.channelOverview
                    : messages.channelPermissions}
                </Dialog.Title>
                <Dialog.Description>
                  {settingsTab === 'overview'
                    ? messages.channelOverviewHint
                    : messages.permissionsHint}
                </Dialog.Description>
              </header>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              {settingsTab === 'overview' && (
                <div className="settings-form-stack channel-overview-form">
                  <div className="field">
                    <label htmlFor="channel-settings-name">{messages.channelName}</label>
                    <EmojiTextInput
                      id="channel-settings-name"
                      value={overviewDraft.name}
                      maxLength={50}
                      locale={locale}
                      emojiLabel={messages.addEmoji}
                      required
                      onChange={(name) => setOverviewDraft((current) => ({ ...current, name }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="channel-settings-topic">{messages.channelTopic}</label>
                    <ChannelTopicEditor
                      value={overviewDraft.topic}
                      locale={locale}
                      messages={messages}
                      onChange={(topic) => setOverviewDraft((current) => ({ ...current, topic }))}
                    />
                  </div>
                  {channel.type === 'TEXT' && (
                    <div className="field">
                      <label htmlFor="channel-settings-slowmode">{messages.slowMode}</label>
                      <select
                        id="channel-settings-slowmode"
                        value={overviewDraft.slowModeSeconds}
                        onChange={(event) =>
                          setOverviewDraft((current) => ({
                            ...current,
                            slowModeSeconds: Number(event.target.value),
                          }))
                        }
                      >
                        <option value={0}>{messages.disabled}</option>
                        <option value={5}>5 {messages.seconds}</option>
                        <option value={10}>10 {messages.seconds}</option>
                        <option value={30}>30 {messages.seconds}</option>
                        <option value={60}>1 {messages.minute}</option>
                        <option value={300}>5 {messages.minutes}</option>
                        <option value={600}>10 {messages.minutes}</option>
                        <option value={3600}>1 {messages.hour}</option>
                        <option value={21600}>6 {messages.hours}</option>
                      </select>
                      <div className="field-hint" style={{ marginTop: 4 }}>
                        {messages.slowModeHint}
                      </div>
                    </div>
                  )}
                  {channel.type === 'VOICE' && (
                    <div className="channel-voice-settings-grid">
                      <div className="channel-range-card">
                        <div className="channel-range-heading">
                          <div>
                            <strong>{messages.voiceUserLimit}</strong>
                            <small>{messages.voiceUserLimitHint}</small>
                          </div>
                          <span>
                            {overviewDraft.userLimit === 0
                              ? messages.noUserLimit
                              : `${overviewDraft.userLimit}`}
                          </span>
                        </div>
                        <input
                          aria-label={messages.voiceUserLimit}
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={overviewDraft.userLimit}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              userLimit: Number(event.target.value),
                            }))
                          }
                        />
                        <div className="channel-range-scale" aria-hidden="true">
                          <span>0</span>
                          <span>25</span>
                          <span>50</span>
                        </div>
                      </div>
                      <div className="channel-range-card">
                        <div className="channel-range-heading">
                          <div>
                            <strong>{messages.voiceBitrate}</strong>
                            <small>{messages.voiceBitrateHint}</small>
                          </div>
                          <span>
                            {overviewDraft.bitrateKbps} kbps · {messages.server} max {bitrateCap}
                          </span>
                        </div>
                        <input
                          aria-label={messages.voiceBitrate}
                          type="range"
                          min={8}
                          max={bitrateCap}
                          step={8}
                          value={overviewDraft.bitrateKbps}
                          onChange={(event) =>
                            setOverviewDraft((current) => ({
                              ...current,
                              bitrateKbps: Number(event.target.value),
                            }))
                          }
                        />
                        <div className="channel-range-scale" aria-hidden="true">
                          <span>8 kbps</span>
                          <span>{Math.round(bitrateCap / 2)} kbps</span>
                          <span>{bitrateCap} kbps</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="channel-settings-category">{messages.category}</label>
                    <select
                      id="channel-settings-category"
                      value={overviewDraft.categoryId}
                      onChange={(event) =>
                        setOverviewDraft((current) => ({
                          ...current,
                          categoryId: event.target.value,
                        }))
                      }
                    >
                      <option value="">{messages.uncategorized}</option>
                      {tree.categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="channel-toggle-card">
                    <div>
                      <strong>{messages.nsfwChannel}</strong>
                      <small>{messages.nsfwChannelHint}</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={overviewDraft.nsfw}
                      onChange={(event) =>
                        setOverviewDraft((current) => ({
                          ...current,
                          nsfw: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
              {settingsTab === 'permissions' &&
                (permissionsLoading ? (
                  <p className="permission-loading">{messages.loading}</p>
                ) : permissionTargets.EVERYONE ? (
                  <div className="permission-matrix channel-permission-workspace">
                    <div className="field">
                      <label htmlFor="channel-permission-target">{messages.permissionTarget}</label>
                      <select
                        id="channel-permission-target"
                        value={selectedTargetKey}
                        onChange={(event) => {
                          const key = event.target.value;
                          setSelectedTargetKey(key);
                          setPermissionTargets((current) =>
                            current[key] ? current : { ...current, [key]: targetFromKey(key) },
                          );
                        }}
                      >
                        <option value="EVERYONE">@weryone</option>
                        {editableRoles.length > 0 && (
                          <optgroup label={messages.roles}>
                            {editableRoles.map((role) => (
                              <option value={`ROLE:${role.id}`} key={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={messages.members}>
                          {editableMembers.map((member) => (
                            <option value={`USER:${member.id}`} key={member.id}>
                              {member.displayName} (@{member.username})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    {permissionTargets[selectedTargetKey] && (
                      <PermissionEditor
                        messages={messages}
                        type={channel.type}
                        value={permissionTargets[selectedTargetKey].permissions}
                        onChange={(permissions) => {
                          const nextTarget: ChannelPermissionTargetState = {
                            ...(permissionTargets[selectedTargetKey] ??
                              targetFromKey(selectedTargetKey)),
                            permissions,
                          };
                          setPermissionTargets((current) => ({
                            ...current,
                            [selectedTargetKey]: nextTarget,
                          }));
                          const baselineTarget = baselinePermissionTargets[selectedTargetKey];
                          const targetDirty =
                            !baselineTarget ||
                            JSON.stringify(nextTarget.permissions) !==
                              JSON.stringify(baselineTarget.permissions);
                          setDirtyTargets((current) =>
                            targetDirty
                              ? current.includes(selectedTargetKey)
                                ? current
                                : [...current, selectedTargetKey]
                              : current.filter((k) => k !== selectedTargetKey),
                          );
                        }}
                      />
                    )}
                  </div>
                ) : null)}
            </div>
            {saveDockPresence.mounted && (
              <div
                className={`settings-save-dock channel-settings-save-dock${saveDockPresence.leaving ? ' is-leaving' : ''}`}
                role="status"
              >
                <span className="settings-save-state">
                  <ShieldCheck size={18} />
                  <span>
                    <strong>
                      {locale === 'tr'
                        ? 'Kaydedilmemiş kanal değişiklikleri var'
                        : 'You have unsaved channel changes'}
                    </strong>
                    <small>
                      {locale === 'tr'
                        ? 'Kanalı güncellemek için değişiklikleri kaydet.'
                        : 'Save to update your channel.'}
                    </small>
                  </span>
                </span>
                <button
                  type="button"
                  className="settings-discard-button"
                  onClick={resetDraft}
                  disabled={busy}
                >
                  <RotateCcw size={16} /> {locale === 'tr' ? 'Geri al' : 'Discard'}
                </button>
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={
                    busy ||
                    permissionsLoading ||
                    !overviewDraft.name.trim() ||
                    !permissionTargets.EVERYONE
                  }
                >
                  <Save size={16} /> {busy ? messages.saving : messages.save}
                </Button>
              </div>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CategorySettingsDialog({
  category,
  onOpenChange,
  server,
  messages,
  onChanged,
}: SharedProps & { category: ChannelCategory | null; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initializedCategoryIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!category) {
      initializedCategoryIdRef.current = null;
      return;
    }
    if (initializedCategoryIdRef.current === category.id) return;
    initializedCategoryIdRef.current = category.id;
    setName(category.name);
    setError('');
    setConfirmDelete(false);
  }, [category]);
  if (!server || !category) return null;
  const activeServer = server;
  const activeCategory = category;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/categories/${activeCategory.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await onChanged(messages.categoryUpdated);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${activeServer.id}/categories/${activeCategory.id}`, {
        method: 'DELETE',
      });
      await onChanged();
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open={Boolean(category)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="compact-dialog category-settings-dialog">
          <DialogHeader
            title={messages.editCategory}
            description={server.name}
            close={messages.close}
          />
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="settings-form-stack">
            <div className="field">
              <label htmlFor="category-settings-name">{messages.categoryName}</label>
              <input
                id="category-settings-name"
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <p className="create-location-hint">{messages.deleteCategoryHint}</p>
            <div className="channel-settings-actions">
              <Button variant="danger" onClick={() => void remove()} disabled={busy}>
                <Trash2 size={16} />
                {confirmDelete ? messages.confirmDelete : messages.deleteCategory}
              </Button>
              <Button onClick={() => void save()} disabled={busy || !name.trim()}>
                <Save size={16} />
                {messages.save}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogHeader({
  title,
  description,
  close,
}: {
  title: string;
  description: string;
  close: string;
}) {
  return (
    <header className="settings-title">
      <div>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </div>
      <Dialog.Close asChild>
        <button className="icon-button" aria-label={close}>
          <X size={20} />
        </button>
      </Dialog.Close>
    </header>
  );
}

function PermissionEditor({
  messages,
  type,
  value,
  onChange,
}: {
  messages: Dictionary;
  type: ServerChannel['type'];
  value: ChannelPermissionOverrideMap;
  onChange: (value: ChannelPermissionOverrideMap) => void;
}) {
  const entries: Array<[keyof ChannelPermissionOverrideMap, string, boolean]> = [
    ['VIEW_CHANNEL', messages.viewChannel, true],
    ['MANAGE_CHANNELS', messages.manageChannels, true],
    ['SEND_MESSAGES', messages.sendMessages, type === 'TEXT'],
    ['ATTACH_FILES', messages.attachFilesPermission, type === 'TEXT'],
    ['USE_GIFS', messages.useGifsPermission, type === 'TEXT'],
    ['USE_EXTERNAL_EMOJIS', messages.useExternalEmojisPermission, type === 'TEXT'],
    ['ADD_REACTIONS', messages.addReactionsPermission, type === 'TEXT'],
    ['CREATE_POLLS', messages.createPollsPermission, type === 'TEXT'],
    ['CONNECT', messages.connectVoice, type === 'VOICE'],
    ['SPEAK', messages.speakVoice, type === 'VOICE'],
    ['USE_SOUNDBOARD', messages.serverPermissions.USE_SOUNDBOARD, type === 'VOICE'],
    ['USE_EXTERNAL_SOUNDS', messages.serverPermissions.USE_EXTERNAL_SOUNDS, type === 'VOICE'],
    ['USE_CAMERA', messages.useCameraPermission, type === 'VOICE'],
    ['SHARE_SCREEN', messages.shareScreenPermission, type === 'VOICE'],
  ];
  return (
    <fieldset className="permission-editor">
      <legend>{messages.channelPermissions}</legend>
      <p>{messages.permissionsHint}</p>
      {entries
        .filter(([, , relevant]) => relevant)
        .map(([permission, label]) => (
          <div className="permission-row" key={permission}>
            <span>
              <strong>{label}</strong>
              <small>{messages.serverPermissionDescriptions[permission]}</small>
            </span>
            <div className="permission-choice" role="group" aria-label={label}>
              {(
                [
                  ['DENY', messages.denyPermission],
                  ['INHERIT', messages.inheritPermission],
                  ['ALLOW', messages.allowPermission],
                ] as Array<[ChannelPermissionValue, string]>
              ).map(([decision, decisionLabel]) => (
                <button
                  type="button"
                  className={`${decision.toLowerCase()}${
                    value[permission] === decision ? ' active' : ''
                  }`}
                  aria-label={`${label}: ${decisionLabel}`}
                  aria-pressed={value[permission] === decision}
                  title={decisionLabel}
                  onClick={() => onChange({ ...value, [permission]: decision })}
                  key={decision}
                >
                  {decision === 'DENY' ? (
                    <X size={17} strokeWidth={2.4} aria-hidden="true" />
                  ) : decision === 'ALLOW' ? (
                    <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    <Waves size={18} strokeWidth={2.2} aria-hidden="true" />
                  )}
                  <span className="visually-hidden">{decisionLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
    </fieldset>
  );
}

function inheritedPermissionMap(): ChannelPermissionOverrideMap {
  return {
    VIEW_CHANNEL: 'INHERIT',
    MANAGE_CHANNELS: 'INHERIT',
    SEND_MESSAGES: 'INHERIT',
    ATTACH_FILES: 'INHERIT',
    USE_GIFS: 'INHERIT',
    USE_EXTERNAL_EMOJIS: 'INHERIT',
    ADD_REACTIONS: 'INHERIT',
    CREATE_POLLS: 'INHERIT',
    CONNECT: 'INHERIT',
    SPEAK: 'INHERIT',
    USE_SOUNDBOARD: 'INHERIT',
    USE_EXTERNAL_SOUNDS: 'INHERIT',
    USE_CAMERA: 'INHERIT',
    SHARE_SCREEN: 'INHERIT',
  };
}

function targetKey(state: ChannelPermissionTargetState): string {
  const { target } = state;
  return target.type === 'EVERYONE'
    ? 'EVERYONE'
    : `${target.type}:${target.type === 'ROLE' ? target.roleId : target.userId}`;
}

function targetFromKey(key: string): ChannelPermissionTargetState {
  const [type, id] = key.split(':');
  if (type === 'ROLE' && id)
    return { target: { type: 'ROLE', roleId: id }, permissions: inheritedPermissionMap() };
  if (type === 'USER' && id)
    return { target: { type: 'USER', userId: id }, permissions: inheritedPermissionMap() };
  return { target: { type: 'EVERYONE' }, permissions: inheritedPermissionMap() };
}
