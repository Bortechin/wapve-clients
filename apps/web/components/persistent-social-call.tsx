'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuthSession } from '@wapve/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiClientError, apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import {
  SocialCallManager,
  type CallPerson,
  type SocialCallRequest,
  type SocialCallVoicePreferences,
} from './social-call';

export type PersistentSocialCallHost = {
  currentUser: CallPerson;
  voicePreferences: SocialCallVoicePreferences;
  selectedConversationId: string | null;
  channelPanelWidth: number;
  onOpenConversation: (conversationId: string) => void;
  prepareForCall: () => Promise<void> | void;
};

type PersistentSocialCallContextValue = {
  updateHost: (host: PersistentSocialCallHost) => void;
  endCalls: () => void;
  leaveCall: () => void;
};

const PersistentSocialCallContext = createContext<PersistentSocialCallContextValue | null>(null);

export function PersistentSocialCallProvider({
  children,
  messages,
}: {
  children: ReactNode;
  messages: Dictionary;
}) {
  const [host, setHost] = useState<PersistentSocialCallHost | null>(null);
  const [request, setRequest] = useState<SocialCallRequest | null>(null);
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: () => apiRequest<AuthSession>('/auth/session'),
  });
  const unauthorized =
    sessionQuery.error instanceof ApiClientError && sessionQuery.error.status === 401;
  const verifiedUserId =
    !unauthorized && sessionQuery.data?.user.emailVerified ? sessionQuery.data.user.id : null;

  const updateHost = useCallback(
    (nextHost: PersistentSocialCallHost) => {
      if (nextHost.currentUser.userId === verifiedUserId) setHost(nextHost);
    },
    [verifiedUserId],
  );
  const endCalls = useCallback(() => {
    setRequest(null);
    setHost(null);
  }, []);
  const leaveCall = useCallback(() => {
    window.dispatchEvent(new Event('wapve:leave-social-call'));
    setRequest(null);
  }, []);

  useEffect(() => {
    if (sessionQuery.isPending) return;
    if (verifiedUserId === null) {
      endCalls();
      return;
    }
    setHost((current) =>
      current && current.currentUser.userId !== verifiedUserId ? null : current,
    );
  }, [endCalls, sessionQuery.isPending, verifiedUserId]);

  useEffect(() => {
    const startCall = (event: Event) =>
      setRequest({ ...(event as CustomEvent<SocialCallRequest>).detail, outgoing: true });
    window.addEventListener('wapve:start-social-call', startCall);
    return () => window.removeEventListener('wapve:start-social-call', startCall);
  }, []);

  const value = useMemo(
    () => ({ updateHost, endCalls, leaveCall }),
    [endCalls, leaveCall, updateHost],
  );

  return (
    <PersistentSocialCallContext.Provider value={value}>
      {children}
      {host && (
        <SocialCallManager
          request={request}
          onRequestHandled={() => setRequest(null)}
          currentUser={host.currentUser}
          voicePreferences={host.voicePreferences}
          selectedConversationId={host.selectedConversationId}
          channelPanelWidth={host.channelPanelWidth}
          onOpenConversation={host.onOpenConversation}
          prepareForCall={host.prepareForCall}
          messages={messages}
        />
      )}
    </PersistentSocialCallContext.Provider>
  );
}

export function usePersistentSocialCalls(): PersistentSocialCallContextValue {
  const value = useContext(PersistentSocialCallContext);
  if (!value) throw new Error('PersistentSocialCallProvider is missing');
  return value;
}
