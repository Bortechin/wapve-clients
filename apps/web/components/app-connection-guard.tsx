'use client';

import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { connectionRetryDelay, connectionRetrySeconds } from './app-connection';

type ConnectionStatus = 'online' | 'offline' | 'restored';
const OFFLINE_TRANSITION_GRACE_MS = 8_000;

export function AppConnectionGuard({ messages }: { messages: Dictionary }) {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [checking, setChecking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [messageIndex, setMessageIndex] = useState(0);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const statusRef = useRef<ConnectionStatus>('online');
  const failedAttemptsRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const offlineTransitionTimerRef = useRef<number | null>(null);
  const restoredTimerRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const checkRef = useRef<() => void>(() => undefined);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    setNextRetryAt(null);
  }, []);

  const scheduleRetry = useCallback((attempts: number) => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    const delay = connectionRetryDelay(attempts);
    const retryAt = Date.now() + delay;
    setNextRetryAt(retryAt);
    retryTimerRef.current = window.setTimeout(() => checkRef.current(), delay);
  }, []);

  const markOffline = useCallback(() => {
    if (statusRef.current === 'offline' || offlineTransitionTimerRef.current !== null) return;
    offlineTransitionTimerRef.current = window.setTimeout(() => {
      offlineTransitionTimerRef.current = null;
      if (restoredTimerRef.current !== null) window.clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = null;
      statusRef.current = 'offline';
      setStatus('offline');
      setNow(Date.now());
      if (typeof window !== 'undefined') {
        (
          window as Window & {
            wapveDesktop?: { reportConnectivity?: (online: boolean) => void };
          }
        ).wapveDesktop?.reportConnectivity?.(false);
      }
      if (retryTimerRef.current === null) scheduleRetry(failedAttemptsRef.current);
    }, OFFLINE_TRANSITION_GRACE_MS);
  }, [scheduleRetry]);

  const checkConnection = useCallback(async () => {
    if (!mountedRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    clearRetry();
    setChecking(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/v1/health?connection_probe=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Health probe failed with ${response.status}`);
      if (!mountedRef.current) return;
      if (offlineTransitionTimerRef.current !== null) {
        window.clearTimeout(offlineTransitionTimerRef.current);
        offlineTransitionTimerRef.current = null;
      }
      failedAttemptsRef.current = 0;
      setFailedAttempts(0);
      setNextRetryAt(null);
      if (typeof window !== 'undefined') {
        (
          window as Window & {
            wapveDesktop?: { reportConnectivity?: (online: boolean) => void };
          }
        ).wapveDesktop?.reportConnectivity?.(true);
      }
      if (statusRef.current !== 'online') {
        statusRef.current = 'restored';
        setStatus('restored');
        restoredTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return;
          statusRef.current = 'online';
          setStatus('online');
        }, 2_800);
      }
    } catch {
      if (!mountedRef.current) return;
      const attempts = failedAttemptsRef.current + 1;
      failedAttemptsRef.current = attempts;
      setFailedAttempts(attempts);
      markOffline();
      if (statusRef.current === 'offline') scheduleRetry(attempts);
    } finally {
      window.clearTimeout(timeout);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      inFlightRef.current = false;
      if (mountedRef.current) setChecking(false);
    }
  }, [clearRetry, markOffline, scheduleRetry]);
  checkRef.current = () => void checkConnection();

  useEffect(() => {
    mountedRef.current = true;
    const wentOffline = () => markOffline();
    const cameOnline = () => void checkConnection();
    if (navigator.onLine) void checkConnection();
    else markOffline();
    const healthTimer = window.setInterval(() => {
      if (statusRef.current === 'online') void checkConnection();
    }, 30_000);
    window.addEventListener('offline', wentOffline);
    window.addEventListener('online', cameOnline);
    return () => {
      mountedRef.current = false;
      window.clearInterval(healthTimer);
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
      if (offlineTransitionTimerRef.current !== null)
        window.clearTimeout(offlineTransitionTimerRef.current);
      if (restoredTimerRef.current !== null) window.clearTimeout(restoredTimerRef.current);
      requestControllerRef.current?.abort();
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('online', cameOnline);
    };
  }, [checkConnection, markOffline]);

  useEffect(() => {
    if (status !== 'offline') return;
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    const rotateMessage = window.setInterval(
      () =>
        setMessageIndex((current) =>
          messages.connectionHints.length > 1
            ? (current + 1 + Math.floor(Math.random() * (messages.connectionHints.length - 1))) %
              messages.connectionHints.length
            : 0,
        ),
      6_500,
    );
    setMessageIndex(Math.floor(Math.random() * messages.connectionHints.length));
    return () => {
      window.clearInterval(clock);
      window.clearInterval(rotateMessage);
    };
  }, [messages.connectionHints, status]);

  if (status === 'online') return null;
  if (status === 'restored') {
    return (
      <div className="connection-restored-toast" role="status" aria-live="polite">
        <CheckCircle2 size={16} />
        <span>
          <strong>{messages.desktopReconnected}</strong>
          <small>{messages.connectionRestoredBody}</small>
        </span>
      </div>
    );
  }

  const retrySeconds = connectionRetrySeconds(nextRetryAt, now);
  return (
    <div className="connection-loss-screen" role="dialog" aria-modal="true">
      <div className="connection-loss-ambient" aria-hidden="true">
        <i />
        <i />
        <span />
        <span />
      </div>
      <section className="connection-loss-card">
        <div className="connection-loss-icon" aria-hidden="true">
          <i />
          <span>
            <WifiOff size={30} />
          </span>
        </div>
        <small>{messages.connectionLostEyebrow}</small>
        <h2>{messages.desktopConnectionProblem}</h2>
        <p>{messages.desktopConnectionProblemBody}</p>
        <blockquote key={messageIndex}>{messages.connectionHints[messageIndex]}</blockquote>
        <div className="connection-retry-status" aria-live="polite">
          <span>
            <i className={checking ? 'checking' : ''} />
            {checking
              ? messages.connectionRetrying
              : messages.connectionRetryIn.replace('{seconds}', String(retrySeconds))}
          </span>
          <small>
            {messages.connectionAttempt.replace('{attempt}', String(failedAttempts + 1))}
          </small>
        </div>
        <button type="button" onClick={() => void checkConnection()} disabled={checking}>
          <RefreshCw className={checking ? 'spin' : ''} size={17} />
          {checking ? messages.connectionRetrying : messages.connectionRetryNow}
        </button>
      </section>
    </div>
  );
}
