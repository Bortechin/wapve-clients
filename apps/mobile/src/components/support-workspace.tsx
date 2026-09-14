import { useCallback, useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import {
  supportCategorySchema,
  supportStatusSchema,
  supportPrioritySchema,
  type SupportTicketSummary,
  type SupportTicketDetail,
  type SupportStaffIdentity,
  type SupportCannedReply,
  type SupportCategory,
} from '@wapve/contracts';
import { View, ScrollView, SafeAreaView, BackHandler } from './themed-native';
import { Text, Pressable, Switch } from './localized-native';
import { Button, Field, ScreenHeader } from './ui';
import { SupportVerification } from './support-verification';
import { SupportAdminTools } from './support-admin-tools';
import { SupportArticles } from './support-articles';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  supportRequest,
  supportLogin,
  supportLogout,
  restoreSupportIdentity,
} from '@/lib/support-client';
import { colors } from '@wapve/design-tokens';
import * as DocumentPicker from 'expo-document-picker';
import { prepareMobileUploadForm } from '@/lib/client';
import { shareSupportAttachment } from '@/lib/support-client';

export function SupportWorkspace({ staff = false }: { staff?: boolean }) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const accountId = user?.id ?? 'guest';
  const cache = useQueryClient();
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [identity, setIdentity] = useState<SupportStaffIdentity | null>(null);
  const [agentName, setAgentName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<SupportCategory>('TECHNICAL');
  const [selected, setSelected] = useState<string | null>(null);
  const [customerView, setCustomerView] = useState<'help' | 'ticket'>('help');
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selected) {
          setSelected(null);
          return true;
        }
        if (!staff && customerView === 'ticket') {
          setCustomerView('help');
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [selected, staff, customerView]),
  );
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [verificationKey, setVerificationKey] = useState(0);
  const scope = staff ? 'staff' : (selected ?? 'guest');
  const base = staff ? '/support/staff/tickets' : '/support/customer/tickets';
  const request = <T,>(path: string, method = 'GET', data?: unknown) =>
    supportRequest<T>(accountId, scope, path, method, data);
  const tickets = useInfiniteQuery({
    queryKey: ['mobile-support', accountId, 'tickets', view, search],
    enabled: staff && Boolean(identity) && !identity?.needsOnboarding,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      request<{ items: SupportTicketSummary[]; nextCursor: string | null }>(
        `/support/staff/tickets?view=${view}&search=${encodeURIComponent(search)}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['mobile-support', accountId, staff, selected],
    enabled: Boolean(selected) && (!staff || Boolean(identity)),
    queryFn: () => request<SupportTicketDetail>(`${base}/${selected}`),
    refetchInterval: 15000,
  });
  const canned = useQuery({
    queryKey: ['mobile-support', accountId, 'canned'],
    enabled: staff && Boolean(identity),
    queryFn: () => request<SupportCannedReply[]>('/support/staff/canned-replies'),
  });
  const agents = useQuery({
    queryKey: ['mobile-support', accountId, 'agents'],
    enabled: staff && Boolean(identity?.owner),
    queryFn: () =>
      request<
        Array<{ id: string; email: string; supportAgentProfile: { displayName: string } | null }>
      >('/support/staff/agents'),
  });
  useEffect(() => {
    let current = true;
    setIdentity(null);
    setSelected(null);
    setBody('');
    if (staff)
      void restoreSupportIdentity(accountId)
        .then((value) => {
          if (current) setIdentity(value);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [accountId, staff]);
  useEffect(() => {
    if (!staff || !identity) return;
    const timeout = setTimeout(
      () => {
        setIdentity(null);
        cache.removeQueries({ queryKey: ['mobile-support', accountId] });
      },
      Math.max(0, new Date(identity.expiresAt).getTime() - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [identity, staff, accountId, cache]);
  async function act(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : tr ? 'İşlem başarısız.' : 'Action failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['mobile-support', accountId] });
  }
  const heading = staff
    ? tr
      ? 'Destek çalışma alanı'
      : 'Support workspace'
    : tr
      ? 'Yardım ve destek'
      : 'Help and support';
  const categoryLabel = (value: string) =>
    ({
      ACCOUNT: tr ? 'Hesap' : 'Account',
      BILLING: tr ? 'Ödeme' : 'Billing',
      TECHNICAL: tr ? 'Teknik' : 'Technical',
      SAFETY: tr ? 'Güvenlik' : 'Safety',
      FEEDBACK: tr ? 'Öneri' : 'Feedback',
      OTHER: tr ? 'Diğer' : 'Other',
    })[value] ?? value;
  const statusLabel = (value: string) =>
    ({
      NEW: tr ? 'Yeni' : 'New',
      IN_PROGRESS: tr ? 'İşlemde' : 'In progress',
      WAITING_CUSTOMER: tr ? 'Müşteri bekleniyor' : 'Waiting for customer',
      RESOLVED: tr ? 'Çözüldü' : 'Resolved',
      CLOSED: tr ? 'Kapandı' : 'Closed',
      SPAM: 'Spam',
    })[value] ?? value;
  const priorityLabel = (value: string) =>
    ({
      LOW: tr ? 'Düşük' : 'Low',
      NORMAL: 'Normal',
      HIGH: tr ? 'Yüksek' : 'High',
      URGENT: tr ? 'Acil' : 'Urgent',
    })[value] ?? value;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScreenHeader
        title={heading}
        left={
          <Button
            variant="ghost"
            label="‹"
            onPress={() => (selected ? setSelected(null) : router.back())}
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
      >
        {!staff && !selected && (
          <>
            <Button
              variant="secondary"
              label={
                customerView === 'help'
                  ? tr
                    ? 'Talep oluştur'
                    : 'Create ticket'
                  : tr
                    ? 'Yardım makaleleri'
                    : 'Help articles'
              }
              onPress={() => setCustomerView((value) => (value === 'help' ? 'ticket' : 'help'))}
            />
            {customerView === 'help' && <SupportArticles />}
          </>
        )}
        {error !== '' && (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
        )}
        {notice !== '' && (
          <Text accessibilityRole="alert" style={{ color: colors.success }}>
            {notice}
          </Text>
        )}
        {staff && !identity && (
          <>
            <Text style={{ color: colors.textMuted }}>
              {tr
                ? 'Destek erişimi için parola ve iki adımlı doğrulama gerekir.'
                : 'Support access requires your password and two-factor authentication.'}
            </Text>
            <Field
              label={tr ? 'E-posta' : 'Email'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label={tr ? 'Parola' : 'Password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Field
              label="2FA"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button
              label={tr ? 'Giriş yap' : 'Sign in'}
              loading={busy}
              onPress={() => {
                void act(async () => {
                  setIdentity(await supportLogin(accountId, { email, password, code }));
                  setPassword('');
                  setCode('');
                });
              }}
            />
          </>
        )}
        {staff && identity?.needsOnboarding && (
          <>
            <Field
              label={tr ? 'Görünen ad' : 'Display name'}
              value={agentName}
              onChangeText={setAgentName}
            />
            <Button
              label={tr ? 'Kaydet' : 'Save'}
              loading={busy}
              onPress={() => {
                void act(async () => {
                  await request('/support/staff/onboarding', 'POST', { displayName: agentName });
                  setIdentity(await request<SupportStaffIdentity>('/support/staff/me'));
                });
              }}
            />
          </>
        )}
        {staff && identity && !identity.needsOnboarding && !selected && (
          <>
            {identity.owner && <SupportAdminTools accountId={accountId} />}
            <Field
              label={tr ? 'Talep ara' : 'Search tickets'}
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {['all', 'mine', 'unassigned', 'waiting', 'resolved'].map((item, i) => (
                <Button
                  key={item}
                  variant={view === item ? 'primary' : 'secondary'}
                  label={
                    (tr
                      ? ['Tümü', 'Bana ait', 'Atanmamış', 'Bekleyen', 'Çözülen']
                      : ['All', 'Mine', 'Unassigned', 'Waiting', 'Resolved'])[i]!
                  }
                  onPress={() => setView(item)}
                />
              ))}
            </ScrollView>
            {tickets.data?.pages
              .flatMap((page) => page.items)
              .map((ticket) => (
                <Pressable
                  key={ticket.id}
                  onPress={() => {
                    setSelected(ticket.id);
                    setBody('');
                  }}
                  style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 }}
                >
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
                    {ticket.subject}
                  </Text>
                  <Text style={{ color: colors.textMuted }}>
                    {ticket.reference} · {categoryLabel(ticket.category)} ·{' '}
                    {statusLabel(ticket.status)}
                  </Text>
                  <Text style={{ color: colors.textMuted }}>
                    {ticket.requesterName ?? ticket.requesterEmail}
                  </Text>
                </Pressable>
              ))}
            {tickets.isPending && <Text>{tr ? 'Yükleniyor…' : 'Loading…'}</Text>}
            {tickets.isError && (
              <Button
                label={tr ? 'Tekrar dene' : 'Retry'}
                onPress={() => {
                  void tickets.refetch();
                }}
              />
            )}
            {tickets.hasNextPage && (
              <Button
                label={tr ? 'Daha fazla' : 'Load more'}
                loading={tickets.isFetchingNextPage}
                onPress={() => {
                  void tickets.fetchNextPage();
                }}
              />
            )}
            {tickets.isSuccess && !tickets.data.pages[0]?.items.length && (
              <Text>{tr ? 'Talep bulunamadı.' : 'No tickets found.'}</Text>
            )}
          </>
        )}
        {!staff && !selected && customerView === 'ticket' && (
          <>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
              {tr ? 'Nasıl yardımcı olabiliriz?' : 'How can we help?'}
            </Text>
            <Field
              label={tr ? 'E-posta' : 'Email'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {supportCategorySchema.options.map((item) => (
                <Button
                  key={item}
                  label={categoryLabel(item)}
                  variant={category === item ? 'primary' : 'secondary'}
                  onPress={() => setCategory(item)}
                />
              ))}
            </View>
            <Field
              label={tr ? 'Konu' : 'Subject'}
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
            />
            <Field
              label={tr ? 'Açıklama' : 'Description'}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={4000}
              style={{ minHeight: 130 }}
            />
            <SupportVerification resetKey={verificationKey} onToken={setTurnstile} />
            <Button
              label={tr ? 'Talep oluştur' : 'Create ticket'}
              disabled={!turnstile}
              loading={busy}
              onPress={() => {
                void act(async () => {
                  try {
                    await request(
                      '/support/tickets',
                      'POST',
                      {
                        email,
                        subject,
                        description: body,
                        category,
                        locale,
                        turnstileToken: turnstile,
                      },
                    );
                    setBody('');
                    setSubject('');
                    setNotice(
                      tr
                        ? 'Talep oluşturuldu. E-posta adresini kontrol edebilirsin.'
                        : 'Ticket created. Check your email for updates.',
                    );
                  } finally {
                    setTurnstile('');
                    setVerificationKey((value) => value + 1);
                  }
                });
              }}
            />
          </>
        )}
        {selected && detail.isError && (
          <Button
            label={tr ? 'Tekrar dene' : 'Retry'}
            onPress={() => {
              void detail.refetch();
            }}
          />
        )}
        {selected && detail.data && (
          <>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
              {detail.data.subject}
            </Text>
            <Text style={{ color: colors.textMuted }}>{detail.data.reference}</Text>
            {staff && (
              <>
                <Button
                  label={tr ? 'Üstlen' : 'Claim'}
                  loading={busy}
                  onPress={() => {
                    void act(async () => {
                      await request(`${base}/${selected}/claim`, 'POST');
                      await refresh();
                    });
                  }}
                />
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {supportStatusSchema.options
                    .filter(
                      (status) => status !== 'NEW' && (identity?.owner || status !== 'CLOSED'),
                    )
                    .map((status) => (
                      <Button
                        key={status}
                        label={statusLabel(status)}
                        variant={detail.data.status === status ? 'primary' : 'secondary'}
                        disabled={busy}
                        onPress={() => {
                          void act(async () => {
                            await request(`${base}/${selected}`, 'PATCH', { status });
                            await refresh();
                          });
                        }}
                      />
                    ))}
                </ScrollView>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {supportPrioritySchema.options.map((priority) => (
                    <Button
                      key={priority}
                      label={priorityLabel(priority)}
                      variant={detail.data.priority === priority ? 'primary' : 'secondary'}
                      disabled={busy}
                      onPress={() => {
                        void act(async () => {
                          await request(`${base}/${selected}`, 'PATCH', { priority });
                          await refresh();
                        });
                      }}
                    />
                  ))}
                </ScrollView>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {agents.data?.map((agent) => (
                    <Button
                      key={agent.id}
                      label={agent.supportAgentProfile?.displayName ?? agent.email}
                      variant="secondary"
                      onPress={() => {
                        void act(async () => {
                          await request(`${base}/${selected}/assignment`, 'PATCH', {
                            agentId: agent.id,
                          });
                          await refresh();
                        });
                      }}
                    />
                  ))}
                </ScrollView>
              </>
            )}
            {detail.data.messages.map((message) => (
              <View
                key={message.id}
                style={{
                  padding: 16,
                  gap: 8,
                  borderRadius: 14,
                  backgroundColor: message.internal ? colors.surfaceRaised : colors.surface,
                }}
              >
                <Text style={{ color: colors.waveBright }}>
                  {message.authorName}
                  {message.internal ? (tr ? ' · İç not' : ' · Internal note') : ''}
                </Text>
                <Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 23 }}>
                  {message.body}
                </Text>
                <Text style={{ color: colors.textMuted }}>
                  {new Date(message.createdAt).toLocaleString(locale)}
                </Text>
              </View>
            ))}
            {staff && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Switch
                    value={internal}
                    onValueChange={setInternal}
                    accessibilityLabel={tr ? 'İç not' : 'Internal note'}
                  />
                  <Text>{tr ? 'İç not' : 'Internal note'}</Text>
                </View>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {canned.data
                    ?.filter((item) => item.active && item.locale === locale)
                    .map((item) => (
                      <Button
                        key={item.id}
                        variant="secondary"
                        label={item.title}
                        onPress={() =>
                          setBody(
                            item.body.replace(
                              /\{\{(\w+)\}\}/g,
                              (match, key: string) =>
                                ({
                                  customer_name:
                                    detail.data?.requesterName ??
                                    (tr ? 'Wapve kullanıcısı' : 'Wapve user'),
                                  ticket_reference: detail.data?.reference ?? '',
                                  agent_name: identity?.displayName ?? '',
                                  article_url: `https://wapve.com/${locale}/support`,
                                  next_step: tr
                                    ? '[Sonraki adımı belirt]'
                                    : '[Specify the next step]',
                                })[key] ?? match,
                            ),
                          )
                        }
                      />
                    ))}
                </ScrollView>
              </>
            )}
            <Field
              label={tr ? 'Yanıt' : 'Reply'}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={staff ? 3800 : 4000}
              style={{ minHeight: 100 }}
            />
            {detail.data.attachments.map((attachment) => (
              <Button
                key={attachment.id}
                variant="secondary"
                label={`${attachment.originalName} · ${Math.ceil(attachment.size / 1024)} KB`}
                disabled={attachment.scanStatus !== 'CLEAN' || busy}
                onPress={() => {
                  void act(() =>
                    shareSupportAttachment(
                      accountId,
                      scope,
                      `${base}/${selected}/attachments/${attachment.id}`,
                      attachment.originalName,
                    ),
                  );
                }}
              />
            ))}
            <Button
              variant="secondary"
              label={tr ? 'Dosya ekle' : 'Attach file'}
              loading={busy}
              onPress={() => {
                void act(async () => {
                  const result = await DocumentPicker.getDocumentAsync({
                    copyToCacheDirectory: true,
                  });
                  if (result.canceled || !result.assets[0]) return;
                  const file = result.assets[0];
                  if ((file.size ?? 0) > 10 * 1024 * 1024)
                    throw new Error(
                      tr ? 'Dosya en fazla 10 MB olabilir.' : 'The maximum file size is 10 MB.',
                    );
                  const prepared = await prepareMobileUploadForm(file.uri, file.name);
                  try {
                    await request(`${base}/${selected}/attachments`, 'POST', prepared.form);
                    await refresh();
                  } finally {
                    prepared.cleanup();
                  }
                });
              }}
            />
            <Button
              label={tr ? 'Gönder' : 'Send'}
              loading={busy}
              disabled={!body.trim()}
              onPress={() => {
                void act(async () => {
                  await request(`${base}/${selected}/messages`, 'POST', {
                    body,
                    ...(staff ? { internal } : {}),
                  });
                  setBody('');
                  await refresh();
                });
              }}
            />
          </>
        )}
        {staff && identity && (
          <Button
            variant="ghost"
            label={tr ? 'Destek oturumunu kapat' : 'Sign out of support'}
            onPress={() => {
              void act(async () => {
                await supportLogout(accountId);
                setIdentity(null);
                setSelected(null);
                cache.removeQueries({ queryKey: ['mobile-support', accountId] });
              });
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
