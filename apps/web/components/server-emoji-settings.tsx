'use client';

import type { ServerEmoji } from '@wapve/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, Save, SmilePlus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function ServerEmojiSettings({
  serverId,
  messages,
  limit,
}: {
  serverId: string;
  messages: Dictionary;
  limit: number;
}) {
  const queryClient = useQueryClient();
  const [emojis, setEmojis] = useState<ServerEmoji[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError('');
    void apiRequest<ServerEmoji[]>(`/servers/${serverId}/emojis`)
      .then((items) => {
        setEmojis(items);
        queryClient.setQueryData(['server-emojis', serverId], items);
      })
      .catch((caught) => setError(errorMessage(caught, messages)));
  }, [messages, queryClient, serverId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawName = data.get('name');
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const file = fileRef.current?.files?.[0];
    if (!file) return setError(messages.serverEmojiFileRequired);
    setBusy(true);
    setProgress(0);
    setError('');
    try {
      const body = new FormData();
      body.append('emoji', file);
      const created = await apiUpload<ServerEmoji>(
        `/servers/${serverId}/emojis?name=${encodeURIComponent(name)}`,
        body,
        setProgress,
      );
      const next = [...emojis, created].sort((a, b) => a.name.localeCompare(b.name));
      setEmojis(next);
      queryClient.setQueryData(['server-emojis', serverId], next);
      event.currentTarget.reset();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>, emojiId: string) {
    event.preventDefault();
    const rawName = new FormData(event.currentTarget).get('name');
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<ServerEmoji>(`/servers/${serverId}/emojis/${emojiId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      const next = emojis.map((emoji) => (emoji.id === emojiId ? updated : emoji));
      setEmojis(next);
      queryClient.setQueryData(['server-emojis', serverId], next);
      setEditingId(null);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function remove(emojiId: string) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/emojis/${emojiId}`, { method: 'DELETE' });
      const next = emojis.filter((emoji) => emoji.id !== emojiId);
      setEmojis(next);
      queryClient.setQueryData(['server-emojis', serverId], next);
      setDeleteId(null);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="server-emoji-settings">
      <section className="settings-section server-settings-card server-emoji-upload-card">
        <header className="server-card-heading">
          <span>
            <SmilePlus size={18} />
          </span>
          <div>
            <h3>{messages.addServerEmoji}</h3>
            <p>{messages.serverEmojiRequirements}</p>
          </div>
          <span className="server-card-badge">
            {emojis.length} / {limit * 2}
          </span>
        </header>
        <form className="server-emoji-upload" onSubmit={(event) => void upload(event)}>
          <label className="field">
            <span>{messages.serverEmojiName}</span>
            <input
              name="name"
              minLength={2}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              required
              placeholder="wave_hello"
            />
          </label>
          <label className="server-emoji-file">
            <ImagePlus size={19} />
            <span>{messages.chooseImage}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            <SmilePlus size={16} /> {busy ? messages.uploading : messages.upload}
          </button>
        </form>
        {progress > 0 && <progress max={100} value={progress} aria-label={messages.uploading} />}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </section>

      <section className="settings-section server-settings-card">
        <header className="server-card-heading">
          <span>
            <SmilePlus size={18} />
          </span>
          <div>
            <h3>{messages.serverEmojis}</h3>
            <p>{messages.serverEmojiListHint}</p>
          </div>
        </header>
        <div className="server-emoji-list">
          {emojis.map((emoji) => (
            <div className="server-emoji-row" key={emoji.id}>
              <img src={emoji.url} alt={`:${emoji.name}:`} />
              {editingId === emoji.id ? (
                <form onSubmit={(event) => void rename(event, emoji.id)}>
                  <input
                    name="name"
                    defaultValue={emoji.name}
                    minLength={2}
                    maxLength={32}
                    pattern="[A-Za-z0-9_]+"
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="icon-button"
                    disabled={busy}
                    aria-label={messages.save}
                  >
                    <Save size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setEditingId(null)}
                    aria-label={messages.cancel}
                  >
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    <strong>:{emoji.name}:</strong>
                    <small>
                      {messages.addedBy} {emoji.createdBy.displayName}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setEditingId(emoji.id)}
                    aria-label={messages.rename}
                  >
                    <Pencil size={15} />
                  </button>
                  {deleteId === emoji.id ? (
                    <button
                      type="button"
                      className="server-emoji-confirm-delete"
                      disabled={busy}
                      onClick={() => void remove(emoji.id)}
                    >
                      {messages.confirm}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => setDeleteId(emoji.id)}
                      aria-label={messages.delete}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {!emojis.length && (
            <div className="server-emoji-empty">
              <SmilePlus size={30} />
              <p>{messages.noServerEmojis}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
