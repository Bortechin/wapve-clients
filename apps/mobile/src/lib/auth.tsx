import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { UserProfile } from '@wapve/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { clearSupportSessions } from './support-client';
import { clearConversationScroll } from './conversation-scroll';
import { api, realtime } from './client';
import { mobileDeviceId, secureTokenStorage } from './session-storage';
import { normalizeLoginIdentifier } from './login-errors';

export type MobileUser = UserProfile;

type AuthState = {
  user: MobileUser | null;
  ready: boolean;
  login(
    identifier: string,
    password: string,
  ): Promise<{ challengeToken?: string; emailApprovalRequired?: boolean }>;
  loginWithPasskey(): Promise<void>;
  completeTwoFactor(challengeToken: string, code: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);
  const accountId = useRef<string | null>(null);
  const applyUser = useCallback(
    async (next: MobileUser | null) => {
      if (accountId.current !== (next?.id ?? null)) {
        realtime.disconnect();
        await queryClient.cancelQueries();
        queryClient.clear();
        clearConversationScroll();
        if (accountId.current) await clearSupportSessions(accountId.current);
        accountId.current = next?.id ?? null;
      }
      setUser(next);
    },
    [queryClient],
  );

  const refreshUser = useCallback(async () => {
    const tokens = await secureTokenStorage.load();
    if (!tokens) {
      await applyUser(null);
      return;
    }
    try {
      const session = await api.request<{ user: MobileUser }>('/auth/mobile/session');
      await applyUser(session.user);
    } catch {
      await applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    void refreshUser().finally(() => setReady(true));
  }, [refreshUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      async login(identifier, password) {
        const result = await api.login<MobileUser>(normalizeLoginIdentifier(identifier), password, await mobileDeviceId());
        if ('requiresEmailApproval' in result) return { emailApprovalRequired: true };
        if ('requiresTwoFactor' in result) return { challengeToken: result.challengeToken };
        await applyUser(result.user);
        return {};
      },
      async completeTwoFactor(challengeToken, code) {
        const result = await api.completeTwoFactor<MobileUser>(
          challengeToken,
          code,
          await mobileDeviceId(),
        );
        await applyUser(result.user);
      },
      async loginWithPasskey() {
        const WapveCredentials = (await import('../../modules/wapve-credentials')).default;
        const challenge = await api.request<{ challengeId: string; options: unknown }>(
          '/auth/mobile/passkeys/login/options',
          { method: 'POST', authenticated: false },
        );
        const credential = JSON.parse(
          await WapveCredentials.authenticatePasskey(JSON.stringify(challenge.options)),
        ) as unknown;
        const result = await api.loginWithPasskey<MobileUser>(challenge.challengeId, credential);
        await applyUser(result.user);
      },
      async logout() {
        realtime.disconnect();
        if (user) await clearSupportSessions(user.id);
        await api.logout();
        queryClient.clear();
        await applyUser(null);
      },
      refreshUser,
    }),
    [ready, refreshUser, user, queryClient, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
