'use client';

import type { ServerInsights } from '@wapve/contracts';
import { BarChart3, Hash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

type InsightsRange = 7 | 14 | 30;

export function ServerInsightsPanel({
  serverId,
  locale,
  messages,
}: {
  serverId: string;
  locale: 'tr' | 'en';
  messages: Dictionary;
}) {
  const [range, setRange] = useState<InsightsRange>(7);
  const [insights, setInsights] = useState<ServerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiRequest<ServerInsights>(`/servers/${serverId}/insights?days=${range}`)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, messages));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, range, messages]);

  const maxDailyMessages = insights
    ? Math.max(...insights.daily.map((point) => point.messages), 1)
    : 1;
  const maxChannelMessages = insights
    ? Math.max(...insights.topChannels.map((channel) => channel.messageCount), 1)
    : 1;
  const dayFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="server-insights">
      <div className="insights-toolbar">
        <span className="insights-toolbar-title">
          <BarChart3 size={16} />
          {messages.insightsDailyMessages}
        </span>
        <div className="insights-range" role="tablist" aria-label={messages.serverInsights}>
          {([7, 14, 30] as InsightsRange[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={range === value}
              className={range === value ? 'active' : ''}
              onClick={() => setRange(value)}
            >
              {messages.insightsRange.replace('{days}', String(value))}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="insights-loading">{messages.loading}</div>}

      {!loading && insights && (
        <>
          <div className="insights-cards">
            <div className="insights-card">
              <small>{messages.insightsMembers}</small>
              <strong>{insights.totals.memberCount}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsJoins7d}</small>
              <strong>{insights.totals.joinsLast7Days}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsMessagesToday}</small>
              <strong>{insights.totals.messagesToday}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsMessages7d}</small>
              <strong>{insights.totals.messagesLast7Days}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsMessages30d}</small>
              <strong>{insights.totals.messagesLast30Days}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsActiveMembers}</small>
              <strong>{insights.totals.activeMembersLast7Days}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsOnline}</small>
              <strong>{insights.totals.onlineCount}</strong>
            </div>
            <div className="insights-card">
              <small>{messages.insightsChannels}</small>
              <strong>
                {insights.totals.textChannelCount + insights.totals.voiceChannelCount}
              </strong>
            </div>
          </div>

          <section className="insights-block">
            <h3>{messages.insightsDailyMessages}</h3>
            {insights.daily.some((point) => point.messages > 0) ? (
              <div
                className="insights-chart"
                style={{ gridTemplateColumns: `repeat(${insights.daily.length}, minmax(0, 1fr))` }}
              >
                {insights.daily.map((point) => (
                  <div
                    key={point.date}
                    className="insights-chart-bar"
                    title={`${dayFormat.format(new Date(point.date))} — ${point.messages}`}
                  >
                    <span
                      style={{ height: `${Math.max(4, (point.messages / maxDailyMessages) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="insights-empty">{messages.insightsEmpty}</p>
            )}
            <div className="insights-chart-axis">
              <span>{dayFormat.format(new Date(insights.daily[0]?.date ?? Date.now()))}</span>
              <span>
                {dayFormat.format(
                  new Date(insights.daily.at(-1)?.date ?? Date.now()),
                )}
              </span>
            </div>
          </section>

          <section className="insights-block">
            <h3>{messages.insightsTopChannels}</h3>
            {insights.topChannels.length ? (
              <ul className="insights-top-channels">
                {insights.topChannels.map((channel) => (
                  <li key={channel.channelId}>
                    <span className="insights-top-channel-name">
                      <Hash size={14} /> {channel.channelName}
                    </span>
                    <span className="insights-top-channel-bar">
                      <span
                        style={{ width: `${(channel.messageCount / maxChannelMessages) * 100}%` }}
                      />
                    </span>
                    <strong>{channel.messageCount}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="insights-empty">{messages.insightsEmpty}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
