'use client';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { EyeOff } from 'lucide-react';
import type { Friend, PrivacySettings, MediaVisibility } from '@wapve/contracts';
import { apiRequest } from '@/lib/api';
import styles from './privacy-settings.module.css';

export function MediaPrivacyGuard({
  children,
  source,
  authorId,
  currentUserId,
  locale,
  visual = true,
}: {
  children: ReactNode;
  source: 'direct' | 'shared';
  authorId?: string | undefined;
  currentUserId: string;
  locale: 'tr' | 'en';
  visual?: boolean;
}) {
  const own = authorId === currentUserId;
  const settings = useQuery({
    queryKey: ['privacy-settings', currentUserId],
    queryFn: () => apiRequest<PrivacySettings>('/users/me/privacy'),
    enabled: visual && !own,
    staleTime: 30_000,
  });
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: visual && !own && source === 'direct',
    staleTime: 30_000,
  });
  const friend = friends.data?.some((item) => item.user.id === authorId) ?? false;
  const policy =
    !visual || own
      ? 'SHOW'
      : source === 'shared'
        ? (settings.data?.mediaServers ?? 'HIDE')
        : friend
          ? (settings.data?.mediaFriends ?? 'HIDE')
          : (settings.data?.mediaOthers ?? 'HIDE');
  if (visual && !own && (!settings.isSuccess || (source === 'direct' && !friends.isSuccess))) return <div className={styles.mediaGuard}><EyeOff size={23}/><span>{locale === 'tr' ? 'Medya tercihlerin yükleniyor.' : 'Loading media preferences.'}</span>{(settings.isError || friends.isError) && <button type="button" onClick={()=>{void settings.refetch();if(source==='direct')void friends.refetch();}}>{locale === 'tr'?'Tekrar dene':'Try again'}</button>}</div>;
  return <GuardContent key={policy} policy={policy} locale={locale}>{children}</GuardContent>;
}
function GuardContent({policy,locale,children}:{policy:MediaVisibility;locale:'tr'|'en';children:ReactNode}) {
  const [opened,setOpened]=useState(false);
  if(policy==='SHOW'||(policy==='HIDE'&&opened))return <>{children}</>;
  const tr = locale === 'tr';
  return (
    <div className={styles.mediaGuard}>
      <EyeOff size={23} />
      <span>
        {policy === 'BLOCK'
          ? tr
            ? 'Medya gizlilik tercihin nedeniyle gösterilmiyor.'
            : 'Media is not displayed because of your privacy preference.'
          : tr
            ? 'Bu medya gizlilik tercihinle gizlendi.'
            : 'This media is hidden by your privacy preference.'}
      </span>
      {policy === 'HIDE' && (
        <button type="button" onClick={() => setOpened(true)}>
          {tr ? 'Medyayı göster' : 'Show media'}
        </button>
      )}
    </div>
  );
}
