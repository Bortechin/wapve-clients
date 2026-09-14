'use client';

import type { ServerEmoji, ServerSound, ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import {
  AudioLines,
  CirclePause,
  CirclePlay,
  Headphones,
  LoaderCircle,
  Plus,
  Smile,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { apiRequest, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { turkishEmojiData } from '@/lib/turkish-emoji-data';
import { CustomStatusEmoji } from './custom-status-emoji';

export function ServerSoundboardSettings({
  serverId,
  messages,
}: {
  serverId: string;
  messages: Dictionary;
}) {
  const [sounds, setSounds] = useState<ServerSound[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceDurationMs, setSourceDurationMs] = useState(0);
  const [clipStartMs, setClipStartMs] = useState(0);
  const [clipDurationMs, setClipDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [volume, setVolume] = useState(100);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const trimDragRef = useRef<{
    mode: 'start' | 'end' | 'selection';
    pointerId: number;
    pointerStartMs: number;
    selectionStartMs: number;
    selectionDurationMs: number;
  } | null>(null);

  useEffect(() => {
    void apiRequest<ServerSound[]>(`/servers/${serverId}/sounds`)
      .then(setSounds)
      .catch((caught) => setError(errorMessage(caught, messages)));
  }, [messages, serverId]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    },
    [previewUrl],
  );

  async function selectFile(file: File | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file ?? null);
    setPreviewing(false);
    setWaveform([]);
    setSourceDurationMs(0);
    setClipStartMs(0);
    setClipDurationMs(0);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    try {
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      const channel = decoded.getChannelData(0);
      const bars = 160;
      const stride = Math.max(1, Math.floor(channel.length / bars));
      const samples = Array.from({ length: bars }, (_, index) => {
        let peak = 0;
        const end = Math.min(channel.length, (index + 1) * stride);
        for (let cursor = index * stride; cursor < end; cursor += 1)
          peak = Math.max(peak, Math.abs(channel[cursor] ?? 0));
        return Math.max(0.07, peak);
      });
      const duration = Math.max(250, Math.round(decoded.duration * 1_000));
      setWaveform(samples);
      setSourceDurationMs(duration);
      setClipDurationMs(Math.min(6_000, duration));
      await context.close();
    } catch {
      setError(messages.serverSoundFileRequired);
    }
  }

  function updateClipStart(nextStartMs: number) {
    const currentEndMs = clipStartMs + clipDurationMs;
    const clampedStartMs = Math.max(
      Math.max(0, currentEndMs - 6_000),
      Math.min(currentEndMs - 250, nextStartMs),
    );
    setClipStartMs(clampedStartMs);
    setClipDurationMs(currentEndMs - clampedStartMs);
  }

  function updateClipEnd(nextEndMs: number) {
    const clampedEndMs = Math.min(
      sourceDurationMs,
      Math.max(clipStartMs + 250, Math.min(clipStartMs + 6_000, nextEndMs)),
    );
    setClipDurationMs(clampedEndMs - clipStartMs);
  }

  function trimPositionMs(track: HTMLDivElement, clientX: number) {
    const rect = track.getBoundingClientRect();
    if (!rect.width || !sourceDurationMs) return 0;
    return Math.max(
      0,
      Math.min(sourceDurationMs, ((clientX - rect.left) / rect.width) * sourceDurationMs),
    );
  }

  function stopPreview() {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    audioRef.current?.pause();
    setPreviewing(false);
  }

  function beginTrimDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sourceDurationMs || !clipDurationMs) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-trim-handle]')?.dataset.trimHandle;
    const onSelection = Boolean(target.closest('[data-trim-selection]'));
    const pointerMs = trimPositionMs(event.currentTarget, event.clientX);
    const mode = handle === 'start' || handle === 'end' ? handle : 'selection';
    let selectionStartMs = clipStartMs;

    if (!handle && !onSelection) {
      selectionStartMs = Math.max(
        0,
        Math.min(sourceDurationMs - clipDurationMs, pointerMs - clipDurationMs / 2),
      );
      setClipStartMs(selectionStartMs);
    }

    stopPreview();
    trimDragRef.current = {
      mode,
      pointerId: event.pointerId,
      pointerStartMs: pointerMs,
      selectionStartMs,
      selectionDurationMs: clipDurationMs,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveTrimDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = trimDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointerMs = trimPositionMs(event.currentTarget, event.clientX);
    if (drag.mode === 'start') updateClipStart(pointerMs);
    else if (drag.mode === 'end') updateClipEnd(pointerMs);
    else {
      const nextStart = Math.max(
        0,
        Math.min(
          sourceDurationMs - drag.selectionDurationMs,
          drag.selectionStartMs + pointerMs - drag.pointerStartMs,
        ),
      );
      setClipStartMs(nextStart);
      setClipDurationMs(drag.selectionDurationMs);
    }
    event.preventDefault();
  }

  function endTrimDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (trimDragRef.current?.pointerId !== event.pointerId) return;
    trimDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function togglePreview() {
    const audio = audioRef.current;
    if (!audio || !clipDurationMs) return;
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    if (previewing) {
      audio.pause();
      setPreviewing(false);
      return;
    }
    audio.currentTime = clipStartMs / 1_000;
    audio.volume = volume / 100;
    void audio.play();
    setPreviewing(true);
    previewTimerRef.current = window.setTimeout(() => {
      audio.pause();
      setPreviewing(false);
      previewTimerRef.current = null;
    }, clipDurationMs);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(messages.serverSoundFileRequired);
      return;
    }
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const body = new FormData();
      body.append('sound', file);
      const value = (key: string, fallback: string) => {
        const candidate = values.get(key);
        return typeof candidate === 'string' ? candidate : fallback;
      };
      const params = new URLSearchParams({
        name: value('name', '').trim(),
        emoji: value('emoji', selectedEmoji).trim() || selectedEmoji || '🔊',
        volume: String(volume),
        clipStartMs: String(clipStartMs),
        clipDurationMs: String(clipDurationMs),
      });
      const created = await apiUpload<ServerSound>(
        `/servers/${serverId}/sounds?${params.toString()}`,
        body,
        setProgress,
      );
      setSounds((current) => [...current, created]);
      event.currentTarget.reset();
      setPreviewUrl(null);
      setSelectedFile(null);
      setWaveform([]);
      setVolume(100);
      setSelectedEmoji('');
      setOpen(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function remove(soundId: string) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/sounds/${soundId}`, { method: 'DELETE' });
      setSounds((current) => current.filter((sound) => sound.id !== soundId));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="server-soundboard-settings">
      <section className="settings-section server-settings-card soundboard-hero-card">
        <div className="soundboard-hero-icon">
          <Headphones size={27} />
        </div>
        <div>
          <span className="server-card-kicker">WAPVE SOUND LAB</span>
          <h3>Ses Tahtası</h3>
          <p>
            Sunucudaki herkesin kullanabileceği kısa sesleri yükle, dinle ve yönet. Yüklemek için
            Sesleri Yönet izni yeterlidir.
          </p>
        </div>
        <button type="button" className="soundboard-add-button" onClick={() => setOpen(true)}>
          <Plus size={17} /> Ses yükle
        </button>
      </section>

      <section className="settings-section server-settings-card">
        <header className="server-card-heading">
          <span>
            <AudioLines size={18} />
          </span>
          <div>
            <h3>Sunucu sesleri</h3>
            <p>
              {sounds.length
                ? `${sounds.length} ses hazır · Ses kanalındaki ses tahtasından oynatılabilir.`
                : 'Henüz ses yüklenmedi.'}
            </p>
          </div>
          <span className="server-card-badge">{sounds.length} / 48</span>
        </header>
        <div className="server-sound-list">
          {sounds.map((sound) => (
            <div className="server-sound-row" key={sound.id}>
              <button
                type="button"
                className="sound-play-button"
                onClick={() => {
                  const audio = new Audio(sound.audioUrl);
                  audio.volume = Math.min(1, sound.volume / 100);
                  void audio.play();
                }}
                aria-label={`${sound.name} oynat`}
              >
                <CirclePlay size={20} />
              </button>
              <span className="sound-emoji">
                <CustomStatusEmoji value={sound.emoji} />
              </span>
              <span className="sound-row-copy">
                <strong>{sound.name}</strong>
                <small>
                  {sound.volume}% ses · {sound.uploader.displayName}
                </small>
              </span>
              <button
                type="button"
                className="icon-button danger"
                onClick={() => void remove(sound.id)}
                disabled={busy}
                aria-label="Sesi sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!sounds.length && (
            <div className="server-sound-empty">
              <AudioLines size={32} />
              <p>İlk sesini yüklediğinde burada görünecek.</p>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {open && (
        <div
          className="soundboard-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <form className="soundboard-upload-modal" onSubmit={(event) => void upload(event)}>
            <button
              type="button"
              className="soundboard-modal-close"
              onClick={() => setOpen(false)}
              aria-label={messages.close}
            >
              <X size={20} />
            </button>
            <span className="server-card-kicker">WAPVE SOUND LAB</span>
            <h3>Bir ses yükle</h3>
            <p className="soundboard-modal-hint">
              MP3, WAV, OGG, WebM, M4A veya AAC · Kullanılacak bölüm en fazla 6 saniye
            </p>
            {previewUrl && (
              <audio
                ref={audioRef}
                className="soundboard-preview"
                src={previewUrl}
                preload="metadata"
              />
            )}
            {waveform.length > 0 && (
              <section
                className="soundboard-clip-editor"
                aria-label="Kullanılacak ses bölümünü seç"
              >
                <header>
                  <strong>Önizleme</strong>
                  <span className="soundboard-clip-valid">
                    {(clipDurationMs / 1_000).toFixed(2)} sn · uygun
                  </span>
                </header>
                <div className="soundboard-waveform">
                  <button
                    type="button"
                    className="soundboard-preview-toggle"
                    onClick={togglePreview}
                    aria-label={previewing ? 'Önizlemeyi durdur' : 'Seçimi dinle'}
                  >
                    {previewing ? <CirclePause size={23} /> : <CirclePlay size={23} />}
                  </button>
                  <div
                    className="soundboard-trim-track"
                    onPointerDown={beginTrimDrag}
                    onPointerMove={moveTrimDrag}
                    onPointerUp={endTrimDrag}
                    onPointerCancel={endTrimDrag}
                  >
                    <div className="soundboard-waveform-bars" aria-hidden="true">
                      {waveform.map((peak, index) => (
                        <i
                          key={index}
                          style={{ height: `${Math.max(8, Math.round(peak * 100))}%` }}
                        />
                      ))}
                    </div>
                    <span
                      className="soundboard-clip-selection"
                      data-trim-selection
                      style={{
                        left: `${(clipStartMs / sourceDurationMs) * 100}%`,
                        width: `${(clipDurationMs / sourceDurationMs) * 100}%`,
                      }}
                    >
                      <i className="start" />
                      <i className="end" />
                    </span>
                    <button
                      className="soundboard-trim-handle start"
                      type="button"
                      role="slider"
                      data-trim-handle="start"
                      style={{ left: `${(clipStartMs / sourceDurationMs) * 100}%` }}
                      aria-label="Başlangıç"
                      aria-valuemin={0}
                      aria-valuemax={Math.max(0, clipStartMs + clipDurationMs - 250)}
                      aria-valuenow={Math.round(clipStartMs)}
                      aria-valuetext={`${(clipStartMs / 1_000).toFixed(2)} saniye`}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') updateClipStart(clipStartMs - 50);
                        if (event.key === 'ArrowRight') updateClipStart(clipStartMs + 50);
                      }}
                    />
                    <button
                      className="soundboard-trim-handle end"
                      type="button"
                      role="slider"
                      data-trim-handle="end"
                      style={{
                        left: `${((clipStartMs + clipDurationMs) / sourceDurationMs) * 100}%`,
                      }}
                      aria-label="Bitiş"
                      aria-valuemin={Math.round(clipStartMs + 250)}
                      aria-valuemax={Math.round(Math.min(sourceDurationMs, clipStartMs + 6_000))}
                      aria-valuenow={Math.round(clipStartMs + clipDurationMs)}
                      aria-valuetext={`${((clipStartMs + clipDurationMs) / 1_000).toFixed(2)} saniye`}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft')
                          updateClipEnd(clipStartMs + clipDurationMs - 50);
                        if (event.key === 'ArrowRight')
                          updateClipEnd(clipStartMs + clipDurationMs + 50);
                      }}
                    />
                  </div>
                </div>
                <div className="soundboard-clip-ranges">
                  <span>
                    Başlangıç <strong>{(clipStartMs / 1_000).toFixed(2)} sn</strong>
                  </span>
                  <span>
                    Bitiş <strong>{((clipStartMs + clipDurationMs) / 1_000).toFixed(2)} sn</strong>
                  </span>
                </div>
              </section>
            )}
            <label className="soundboard-file-input">
              <Upload size={18} />
              <span>{selectedFile?.name ?? 'Bir dosya seç'}</span>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                required
                onChange={(event) => void selectFile(event.target.files?.[0])}
              />
            </label>
            <div className="soundboard-form-grid">
              <label className="field">
                <span>Ses adı *</span>
                <input name="name" required maxLength={32} placeholder="Basayım" />
              </label>
              <div className="field">
                <span>İlgili emoji</span>
                <input type="hidden" name="emoji" value={selectedEmoji} />
                <SoundboardEmojiPicker
                  serverId={serverId}
                  messages={messages}
                  value={selectedEmoji}
                  onSelect={setSelectedEmoji}
                />
              </div>
            </div>
            <label className="field">
              <span>
                Ses seviyesi <b className="sound-volume-value">{volume}%</b>
              </span>
              <span
                className="sound-volume-control"
                style={{ '--sound-volume-progress': `${volume}%` } as CSSProperties}
              >
                <span className="sound-volume-track" aria-hidden="true">
                  <i />
                </span>
                <input
                  className="sound-volume-range"
                  name="volume"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  aria-label="Ses seviyesi"
                  onChange={(event) => {
                    const nextVolume = Number(event.currentTarget.value);
                    setVolume(nextVolume);
                    if (audioRef.current) audioRef.current.volume = nextVolume / 100;
                  }}
                />
              </span>
            </label>
            {progress > 0 && <progress max={100} value={progress} aria-label="Yükleniyor" />}
            <div className="soundboard-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
                Boş ver
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={busy || clipDurationMs < 250 || clipDurationMs > 6_000}
              >
                {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{' '}
                {busy ? 'Yükleniyor…' : 'Yükle'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SoundboardEmojiPicker({
  serverId,
  messages,
  value,
  onSelect,
}: {
  serverId: string;
  messages: Dictionary;
  value: string;
  onSelect: (emoji: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string>(serverId);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const emojiServers = useQuery({
    queryKey: ['emoji-picker-servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
    enabled: open,
    staleTime: 60_000,
  });

  const servers = useMemo(() => {
    const list = emojiServers.data ?? [];
    if (!serverId) return list;
    const current = list.find((s) => s.id === serverId);
    const others = list.filter((s) => s.id !== serverId);
    if (current) {
      return [current, ...others];
    }
    return [
      {
        id: serverId,
        name: messages.serverEmojis ?? 'Sunucu',
        iconUrl: null,
        permissions: [],
      } as unknown as ServerSummary,
      ...list,
    ];
  }, [emojiServers.data, messages.serverEmojis, serverId]);

  const currentActiveId = activeServerId || serverId || servers[0]?.id || '';
  const activeServer = servers.find((s) => s.id === currentActiveId);

  const activeEmojisQuery = useQuery({
    queryKey: ['soundboard-server-emojis', currentActiveId],
    queryFn: () => apiRequest<ServerEmoji[]>(`/servers/${currentActiveId}/emojis`),
    enabled: open && Boolean(currentActiveId),
    staleTime: 60_000,
  });

  const activeCustomEmojis = useMemo(
    () => (activeEmojisQuery.data ?? []).filter((emoji) => !emoji.animated),
    [activeEmojisQuery.data],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 480;
      const panelWidth = Math.min(480, window.innerWidth - 24);

      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;

      let topOrBottom: CSSProperties = {};
      if (spaceAbove >= panelHeight + 10) {
        topOrBottom = { bottom: 'calc(100% + 8px)', top: 'auto' };
      } else if (spaceBelow >= panelHeight + 10) {
        topOrBottom = { top: 'calc(100% + 8px)', bottom: 'auto' };
      } else if (spaceAbove >= spaceBelow) {
        const overflow = panelHeight + 8 - spaceAbove;
        topOrBottom = {
          bottom: `calc(100% + 8px - ${Math.max(0, Math.ceil(overflow + 12))}px)`,
          top: 'auto',
        };
      } else {
        topOrBottom = { top: 'calc(100% + 8px)', bottom: 'auto' };
      }

      let rightStyle: string | number = 0;
      if (triggerRect.right - panelWidth < 12) {
        const diff = 12 - (triggerRect.right - panelWidth);
        rightStyle = -diff;
      }

      setPanelStyle({
        position: 'absolute',
        right: rightStyle,
        width: `${panelWidth}px`,
        ...topOrBottom,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [open, activeCustomEmojis.length]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="soundboard-emoji-picker-container">
      <button
        ref={triggerRef}
        type="button"
        className="soundboard-emoji-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="İlgili emoji seç"
        title="Emoji seç"
      >
        {value ? (
          <span className="soundboard-emoji-trigger-icon">
            <CustomStatusEmoji value={value} />
          </span>
        ) : (
          <Smile size={18} className="soundboard-emoji-trigger-smile" aria-hidden="true" />
        )}
        <span className="soundboard-emoji-trigger-text">
          {value ? (value.startsWith('<:') ? value.split(':')[1] : value) : 'Seçmek için tıkla'}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            className="soundboard-emoji-clear-btn"
            title="Emojiyi kaldır"
            onClick={(e) => {
              e.stopPropagation();
              onSelect('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onSelect('');
              }
            }}
          >
            <X size={14} />
          </span>
        ) : null}
      </button>

      {open && (
        <section
          ref={panelRef}
          className="composer-media-panel soundboard-composer-media-panel"
          style={panelStyle}
          aria-label={messages.emoji ?? 'Emoji'}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="composer-media-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={true} className="active">
              {messages.emoji ?? 'Emoji'}
            </button>
            <button
              className="media-close"
              type="button"
              aria-label={messages.close ?? 'Kapat'}
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>

          <div className="composer-emoji-picker">
            <div className="composer-server-emoji-picker">
              <aside
                className="composer-server-emoji-rail"
                aria-label={messages.serverEmojis ?? 'Sunucu emojileri'}
              >
                {servers.map((server) => (
                  <button
                    type="button"
                    key={server.id}
                    className={server.id === currentActiveId ? 'active' : ''}
                    title={server.name}
                    aria-label={server.name}
                    onClick={() => setActiveServerId(server.id)}
                  >
                    {server.iconUrl ? (
                      <img src={server.iconUrl} alt="" />
                    ) : (
                      <span>{server.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </button>
                ))}
              </aside>

              <section
                className="composer-custom-emojis"
                aria-label={activeServer?.name ?? (messages.serverEmojis ?? 'Sunucu emojileri')}
              >
                <header>
                  <strong>
                    {activeServer?.name ?? (messages.serverEmojis ?? 'Sunucu emojileri')}
                  </strong>
                  <small>{activeCustomEmojis.length} / 25</small>
                </header>
                <div>
                  {activeCustomEmojis.map((emoji) => (
                    <button
                      type="button"
                      key={emoji.id}
                      title={`:${emoji.name}:`}
                      aria-label={`:${emoji.name}:`}
                      onClick={() => {
                        onSelect(`<:${emoji.name}:${emoji.id}>`);
                        setOpen(false);
                      }}
                    >
                      <img src={emoji.url} alt={`:${emoji.name}:`} />
                    </button>
                  ))}
                  {!activeCustomEmojis.length && (
                    <p className="composer-emoji-empty">
                      {messages.noServerEmojis ?? 'Bu sunucuya henüz özel emoji eklenmedi.'}
                    </p>
                  )}
                </div>
              </section>
            </div>

            <EmojiPicker
              width="100%"
              height={355}
              theme={Theme.DARK}
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis
              emojiData={turkishEmojiData}
              searchPlaceholder="Mükemmel emojiyi bul"
              searchClearButtonLabel="Aramayı temizle"
              previewConfig={{ showPreview: false }}
              onEmojiClick={(data) => {
                onSelect(data.emoji);
                setOpen(false);
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
