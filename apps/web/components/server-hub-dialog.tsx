'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import type { ServerSummary } from '@wapve/contracts';
import { ArrowLeft, Gamepad2, LogIn, Plus, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

type Stage = 'landing' | 'create' | 'join';

export function ServerHubDialog({
  open,
  onOpenChange,
  messages,
  onServer,
  initialInviteCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Dictionary;
  onServer: (server: ServerSummary, notice: string) => void;
  initialInviteCode?: string | undefined;
}) {
  const [stage, setStage] = useState<Stage>(initialInviteCode ? 'join' : 'landing');
  const [template, setTemplate] = useState<'CHAT' | 'GAMING'>('CHAT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStage(initialInviteCode ? 'join' : 'landing');
      setError('');
    }
  }, [initialInviteCode, open]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const server = await apiRequest<ServerSummary>('/servers', {
        method: 'POST',
        body: JSON.stringify({ name: data.get('name'), template }),
      });
      onServer(server, messages.serverCreated);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const server = await apiRequest<ServerSummary>('/servers/actions/join', {
        method: 'POST',
        body: JSON.stringify({ code: data.get('code') }),
      });
      onServer(server, messages.serverJoined);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  const templates = [
    ['CHAT', messages.serverTemplateChat, Users],
    ['GAMING', messages.serverTemplateGaming, Gamepad2],
  ] as const;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="compact-dialog server-hub-dialog"
          aria-describedby="server-hub-description"
        >
          <header className="server-hub-head">
            {stage !== 'landing' && (
              <button
                className="icon-button"
                onClick={() => setStage('landing')}
                aria-label={messages.back}
              >
                <ArrowLeft size={19} />
              </button>
            )}
            <div>
              <Dialog.Title>
                {stage === 'join' ? messages.joinServer : messages.createYourServer}
              </Dialog.Title>
              <Dialog.Description id="server-hub-description">
                {stage === 'join' ? messages.joinServerHint : messages.serverHubHint}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label={messages.close}>
                <X size={20} />
              </button>
            </Dialog.Close>
          </header>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {stage === 'landing' && (
            <div className="server-hub-actions">
              <button className="server-hub-primary" onClick={() => setStage('create')}>
                <span>
                  <Sparkles size={22} />
                </span>
                <div>
                  <strong>{messages.createServer}</strong>
                  <small>{messages.createServerHint}</small>
                </div>
                <Plus size={18} />
              </button>
              <div className="server-template-grid">
                {templates.map(([value, label, Icon]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTemplate(value);
                      setStage('create');
                    }}
                  >
                    <Icon size={21} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="server-hub-join">
                <div>
                  <strong>{messages.alreadyHaveInvite}</strong>
                  <small>{messages.joinServerHint}</small>
                </div>
                <Button variant="secondary" onClick={() => setStage('join')}>
                  <LogIn size={17} />
                  {messages.joinServer}
                </Button>
              </div>
            </div>
          )}
          {stage === 'create' && (
            <form className="server-hub-form" onSubmit={(event) => void create(event)}>
              <div className="server-template-badge">
                <Sparkles size={16} />
                {templates.find(([value]) => value === template)?.[1]}
              </div>
              <div className="server-icon-preview">
                <Plus size={24} />
                <small>{messages.serverIconLater}</small>
              </div>
              <label className="field">
                <span>{messages.serverName}</span>
                <input
                  id="new-server-name"
                  name="name"
                  minLength={2}
                  maxLength={100}
                  required
                  autoFocus
                  placeholder={messages.serverNamePlaceholder}
                />
                <small>{messages.serverNameHint}</small>
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? messages.saving : messages.createServer}
              </Button>
            </form>
          )}
          {stage === 'join' && (
            <form className="server-hub-form" onSubmit={(event) => void join(event)}>
              <div className="server-join-visual">
                <LogIn size={28} />
                <strong>{messages.joinCommunity}</strong>
                <span>{messages.inviteExamples}</span>
              </div>
              <label className="field">
                <span>{messages.inviteLink}</span>
                <input
                  id="server-invite-code"
                  name="code"
                  minLength={6}
                  maxLength={256}
                  required
                  autoFocus
                  autoComplete="off"
                  defaultValue={initialInviteCode ?? ''}
                  placeholder="https://wapve.cc/WJNjsd87"
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? messages.loading : messages.joinServer}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
