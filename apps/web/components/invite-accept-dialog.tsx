'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { AcceptedServerInvite, ServerInvitePreview } from '@wapve/contracts';
import { Button } from '@wapve/ui';
import { Hash, LoaderCircle, LogIn, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function InviteAcceptDialog({
  code,
  messages,
  onAccepted,
  onClose,
}: {
  code: string | null;
  messages: Dictionary;
  onAccepted: (result: AcceptedServerInvite) => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ServerInvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let active = true;
    setPreview(null);
    setError('');
    void apiRequest<ServerInvitePreview | null>('/servers/invites/preview', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((value) => {
        if (!active) return;
        if (value) setPreview(value);
        else setError(messages.inviteUnavailable);
      })
      .catch((caught) => active && setError(errorMessage(caught, messages)));
    return () => {
      active = false;
    };
  }, [code, messages]);

  async function accept() {
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      onAccepted(
        await apiRequest<AcceptedServerInvite>('/servers/actions/accept-invite', {
          method: 'POST',
          body: JSON.stringify({ code }),
        }),
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  const ChannelIcon = preview?.channel?.type === 'VOICE' ? Volume2 : Hash;
  return (
    <Dialog.Root open={Boolean(code)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="compact-dialog invite-accept-dialog">
          <Dialog.Close asChild>
            <button className="icon-button invite-accept-close" aria-label={messages.close}>
              <X size={19} />
            </button>
          </Dialog.Close>
          {!preview && !error ? (
            <div className="invite-accept-loading">
              <LoaderCircle className="spin" size={28} />
            </div>
          ) : preview ? (
            <>
              <div className="invite-server-icon">
                {preview.server.iconUrl ? (
                  <img src={preview.server.iconUrl} alt="" />
                ) : (
                  preview.server.name[0]
                )}
              </div>
              <Dialog.Title>{preview.server.name}</Dialog.Title>
              <Dialog.Description>{messages.invitedToServer}</Dialog.Description>
              {preview.channel && (
                <div className="invite-target-channel">
                  <ChannelIcon size={18} />
                  <span>
                    <strong>{preview.channel.name}</strong>
                    <small>
                      {preview.channel.type === 'VOICE'
                        ? messages.voiceChannel
                        : messages.textChannel}
                    </small>
                  </span>
                </div>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <Button onClick={() => void accept()} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}
                {preview.alreadyMember
                  ? preview.channel?.type === 'VOICE'
                    ? messages.joinVoice
                    : messages.openChannel
                  : preview.channel?.type === 'VOICE'
                    ? messages.joinServerAndVoice
                    : messages.joinServerAndOpen}
              </Button>
            </>
          ) : (
            <>
              <Dialog.Title>{messages.inviteUnavailable}</Dialog.Title>
              <Dialog.Description>{error}</Dialog.Description>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
