'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gameNames, gameIcons, type GameActivity, type PresenceUpdate } from '@wapve/contracts';
import { Gamepad2 } from 'lucide-react';
import { CustomStatusEmoji } from './custom-status-emoji';

function hasValidContent(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false || node === true) return false;
  if (typeof node === 'string') return node.trim() !== '' && node !== '\u00a0';
  if (typeof node === 'number') return true;
  if (Array.isArray(node)) return node.some(hasValidContent);
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    if (props && 'children' in props) {
      return hasValidContent(props.children);
    }
  }
  return true;
}

export function GameStatus({
  user,
  locale,
  full = false,
  children,
}: {
  user: {
    id: string;
    status: string;
    gameActivity?: GameActivity | null | undefined;
    profileRestricted?: boolean | undefined;
    customStatusText?: string | null | undefined;
    customStatusEmoji?: string | null | undefined;
  };
  locale: string;
  full?: boolean;
  children?: ReactNode;
}) {
  const { data } = useQuery<PresenceUpdate>({ queryKey: ['live-presence', user.id], enabled: false });
  const activity = data ? data.gameActivity : user.gameActivity;
  const isOffline = (data?.status ?? user.status) === 'OFFLINE';

  if (user.profileRestricted || isOffline || !activity) return <>{children ?? null}</>;

  const name = gameNames[activity.gameId] ?? activity.gameId;
  const statusText = data?.customStatusText !== undefined ? data.customStatusText : user.customStatusText;
  const statusEmoji = data?.customStatusEmoji !== undefined ? data.customStatusEmoji : user.customStatusEmoji;
  const hasDirectStatus = Boolean(statusText?.trim() || statusEmoji);
  const hasChildStatus = hasValidContent(children);

  if (hasChildStatus || hasDirectStatus) {
    const statusBody = hasChildStatus ? (
      children
    ) : (
      <>
        {statusEmoji && <CustomStatusEmoji value={statusEmoji} />}{' '}
        {statusText}
      </>
    );

    return (
      <span
        className={`game-status${full ? ' game-status-full' : ''}`}
        title={`${name} (${locale === 'tr' ? 'Oynuyor' : 'Playing'})`}
      >
        <Gamepad2 size={13} className="game-status-controller-icon" aria-hidden="true" />
        <span className="game-status-dot" aria-hidden="true">•</span>
        <span className="game-status-text">{statusBody}</span>
      </span>
    );
  }

  return (
    <span className={`game-status${full ? ' game-status-full' : ''}`} title={name}>
      <Gamepad2 size={13} className="game-status-controller-icon" aria-hidden="true" />
      <span className="game-status-text">
        <span>{name}</span>
        <span className="game-status-suffix">{locale === 'tr' ? ' dalgasında' : ' playing'}</span>
      </span>
    </span>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function ProfileGameActivity({
  user,
  locale,
}: {
  user: {
    id: string;
    status: string;
    gameActivity?: GameActivity | null | undefined;
    profileRestricted?: boolean | undefined;
  };
  locale: string;
}) {
  const { data } = useQuery<PresenceUpdate>({ queryKey: ['live-presence', user.id], enabled: false });
  const activity = data ? data.gameActivity : user.gameActivity;
  const isOffline = (data?.status ?? user.status) === 'OFFLINE';

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activity?.startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activity?.startedAt]);

  if (user.profileRestricted || isOffline || !activity) return null;

  const name = gameNames[activity.gameId] ?? activity.gameId;
  const icon = gameIcons[activity.gameId] ?? '/games/minecraft.svg';

  const elapsedSeconds = activity.startedAt
    ? Math.max(0, Math.floor((now - activity.startedAt) / 1000))
    : null;

  const durationString = elapsedSeconds !== null ? formatDuration(elapsedSeconds) : null;

  return (
    <div className="profile-card-section profile-game-activity">
      <b className="profile-game-heading">{locale === 'tr' ? 'Oynuyor' : 'Playing a Game'}</b>
      <div className="profile-game-card">
        <div className="profile-game-icon-box">
          <img src={icon} alt={name} className="profile-game-icon" />
        </div>
        <div className="profile-game-info">
          <strong className="profile-game-name" title={name}>
            {name}
          </strong>
          <div className="profile-game-time" title={durationString ? (locale === 'tr' ? `${durationString} süredir oynuyor` : `Playing for ${durationString}`) : undefined}>
            <Gamepad2 size={14} className="profile-game-controller-icon" />
            <span>
              {durationString ?? (locale === 'tr' ? 'Şimdi başladı' : 'Just started')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
