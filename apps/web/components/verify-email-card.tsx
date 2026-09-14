'use client';

import { Button } from '@wapve/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';

type State = 'waiting' | 'verifying' | 'success' | 'failed';

const verificationRequests = new Map<string, Promise<void>>();

function confirmEmail(token: string): Promise<void> {
  const pending = verificationRequests.get(token);
  if (pending) return pending;
  const request = apiRequest<void>('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }).catch((error: unknown) => {
    verificationRequests.delete(token);
    throw error;
  });
  verificationRequests.set(token, request);
  return request;
}

export function VerifyEmailCard({
  messages,
  continueTo = '/app',
}: {
  messages: Dictionary;
  continueTo?: string;
}) {
  const queryClient = useQueryClient();
  const token = useSearchParams().get('token');
  const [state, setState] = useState<State>(token ? 'verifying' : 'waiting');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    void confirmEmail(token)
      .then(async () => {
        // The locale layout keeps the session query mounted on authentication
        // pages. Refresh it before navigating so verified accounts do not stay
        // in the cached read-only state for the query stale window.
        await queryClient.invalidateQueries({ queryKey: ['session'] });
        setState('success');
      })
      .catch(() => setState('failed'));
  }, [queryClient, token]);

  async function resend() {
    try {
      await apiRequest('/auth/email-verification/resend', { method: 'POST', body: '{}' });
      setResent(true);
    } catch {
      setResent(false);
    }
  }

  return (
    <div className="auth-card" style={{ textAlign: 'center' }}>
      <div className="empty-illustration" style={{ marginInline: 'auto' }}>
        {state === 'success' ? (
          <CheckCircle2 size={46} />
        ) : state === 'failed' ? (
          <XCircle size={46} />
        ) : (
          <MailCheck size={46} />
        )}
      </div>
      <h1>{state === 'success' ? messages.verificationSuccess : messages.checkInbox}</h1>
      <p>
        {state === 'failed'
          ? messages.verificationFailed
          : state === 'verifying'
            ? messages.loading
            : messages.verificationSent}
      </p>
      {resent && <div className="form-success">{messages.verificationSent}</div>}
      <div className="form-stack" style={{ marginTop: 18 }}>
        {state === 'waiting' && (
          <Button fullWidth onClick={() => void resend()}>
            {messages.resend}
          </Button>
        )}
        {(state === 'success' || state === 'waiting') && (
          <Link className="wapve-button wapve-button--secondary" href={continueTo}>
            {messages.continueToApp}
          </Link>
        )}
        {state === 'failed' && (
          <Link className="text-link" href="/login">
            {messages.login}
          </Link>
        )}
      </div>
    </div>
  );
}
