'use client';

import { useQuery } from '@tanstack/react-query';
import type { ServerDiscoveryEntry, ServerSummary } from '@wapve/contracts';
import { ArrowUpRight, Compass, Radio, Search, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function ServerDiscoveryPanel({
  messages,
  locale,
  onServer,
}: {
  messages: Dictionary;
  locale: 'tr' | 'en';
  onServer: (server: ServerSummary, notice?: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['server-discovery', search.trim()],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '48' });
      if (search.trim()) params.set('q', search.trim());
      return apiRequest<ServerDiscoveryEntry[]>(`/servers/discovery?${params.toString()}`);
    },
    staleTime: 30_000,
  });
  const entries = query.data ?? [];
  const numberFormat = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US');

  async function openOrJoin(entry: ServerDiscoveryEntry) {
    setBusyId(entry.id);
    setError('');
    try {
      const server = entry.isMember
        ? await apiRequest<ServerSummary>(`/servers/${entry.id}`)
        : await apiRequest<ServerSummary>('/servers/actions/join-discovery', {
            method: 'POST',
            body: JSON.stringify({ serverId: entry.id }),
          });
      onServer(server, entry.isMember ? undefined : messages.serverJoined);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="server-discovery-panel">
      <div className="server-discovery-hero">
        <div className="server-discovery-hero-icon">
          <Compass size={30} />
        </div>
        <div>
          <span className="settings-eyebrow">
            <Sparkles size={13} /> WAPVE / {messages.discoverServers}
          </span>
          <h2>{messages.discoverServers}</h2>
          <p>{messages.discoverServersHint}</p>
        </div>
        <label className="server-discovery-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={messages.discoverSearchPlaceholder}
            aria-label={messages.discoverSearchPlaceholder}
            maxLength={100}
          />
        </label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="server-discovery-toolbar">
        <div>
          <strong>{search.trim() ? messages.discoverSearchResults : messages.discoverFeatured}</strong>
          <small>{entries.length} {messages.discoverServers.toLocaleLowerCase()}</small>
        </div>
        <span className="server-discovery-secure"><Compass size={14} /> {messages.discoverCurated}</span>
      </div>
      {query.isPending ? (
        <div className="server-discovery-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => <div className="server-discovery-skeleton" key={index} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="server-discovery-empty">
          <Compass size={38} />
          <h3>{messages.discoverNoResults}</h3>
          <p>{messages.discoverNoResultsHint}</p>
        </div>
      ) : (
        <div className="server-discovery-grid">
          {entries.map((entry) => (
            <article className="server-discovery-card" key={entry.id}>
              <div className="server-discovery-card-media">
                {entry.bannerUrl ? <img src={entry.bannerUrl} alt="" /> : <span />}
                <div className="server-discovery-card-icon">
                  {entry.iconUrl ? <img src={entry.iconUrl} alt="" /> : entry.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="server-discovery-card-body">
                <h3 title={entry.name}>{entry.name}</h3>
                <p>{entry.description || messages.discoverDefaultDescription}</p>
                <div className="server-discovery-card-meta">
                  <span><i className="online-dot" /> {numberFormat.format(entry.onlineCount)} {messages.discoverOnline}</span>
                  <span><Users size={13} /> {numberFormat.format(entry.memberCount)} {messages.discoverMembers}</span>
                </div>
                <button
                  className={`server-discovery-join${entry.isMember ? ' joined' : ''}`}
                  disabled={busyId === entry.id}
                  onClick={() => void openOrJoin(entry)}
                >
                  {busyId === entry.id ? messages.loading : entry.isMember ? messages.discoverOpen : messages.discoverJoin}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <footer className="server-discovery-footer">
        <Radio size={15} /> {messages.discoverOwnerHint}
      </footer>
    </div>
  );
}
