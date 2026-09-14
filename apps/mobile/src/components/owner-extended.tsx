import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  ownerAnalyticsSchema,
  ownerAdminCaseSchema,
  ownerRiskEventSchema,
  ownerBillingEntrySchema,
  ownerIpBlockSchema,
  ownerAdminCaseCreateSchema,
  ownerAdminCaseUpdateSchema,
  ownerAdminCaseNoteSchema,
  ownerAdminCaseReplySchema,
  ownerAdminCaseEvidenceSchema,
  ownerAppealCreateSchema,
  ownerAppealUpdateSchema,
  ownerRiskEventUpdateSchema,
  ownerIpBlockCreateSchema,
  ownerBillingRefundSchema,
} from '@wapve/contracts';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { View, ScrollView } from './themed-native';
import { Text, Alert } from './localized-native';
import { Button, Field } from './ui';
import { colors } from '@wapve/design-tokens';

type Section = 'analytics' | 'cases' | 'appeals' | 'risk-events' | 'ip-blocks' | 'billing';
type FormField = { key: string; tr: string; en: string; options?: string[]; number?: boolean };
export type OwnerAction = {
  title: string;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  schema: z.ZodType;
  fields: FormField[];
  fixed?: Record<string, unknown>;
  confirm?: boolean;
};
type Action = OwnerAction;
const reason: FormField = { key: 'reason', tr: 'Sebep', en: 'Reason' };
const bodyField: FormField = { key: 'body', tr: 'Metin', en: 'Text' };
const caseStatuses = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED'];
const appealSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  userId: z.string(),
  reason: z.string(),
  status: z.string(),
  response: z.string().nullable(),
});

export function OwnerExtended({ access }: { access: string }) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const [section, setSection] = useState<Section>('analytics');
  const [form, setForm] = useState<Action | null>(null);
  const headers = { 'X-Wapve-Owner-Access': access };
  const query = useQuery({
    queryKey: ['owner-extended', access, section],
    queryFn: () => api.request<unknown>(`/owner/${section}`, { headers }),
  });
  const sections: Array<[Section, string]> = [
    ['analytics', tr ? 'Büyüme ve kullanım' : 'Growth and usage'],
    ['cases', tr ? 'Vakalar' : 'Cases'],
    ['appeals', tr ? 'İtirazlar' : 'Appeals'],
    ['risk-events', tr ? 'Risk olayları' : 'Risk events'],
    ['ip-blocks', tr ? 'Erişim engelleri' : 'Access blocks'],
    ['billing', tr ? 'Ödemeler' : 'Billing'],
  ];
  const metric = ownerAnalyticsSchema.safeParse(query.data);
  const cases = z.array(ownerAdminCaseSchema).safeParse(query.data);
  const appeals = z.array(appealSchema).safeParse(query.data);
  const risks = z.array(ownerRiskEventSchema).safeParse(query.data);
  const blocks = z.array(ownerIpBlockSchema).safeParse(query.data);
  const billing = z.array(ownerBillingEntrySchema).safeParse(query.data);
  const label = (turkish: string, english: string) => (tr ? turkish : english);
  const statusField = (options: string[]): FormField => ({
    key: 'status',
    tr: 'Durum',
    en: 'Status',
    options,
  });
  return (
    <View style={{ gap: 16 }}>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {sections.map(([id, name]) => (
          <Button
            key={id}
            label={name}
            variant={section === id ? 'primary' : 'secondary'}
            onPress={() => {
              setSection(id);
              setForm(null);
            }}
          />
        ))}
      </ScrollView>
      {query.isPending && <Text>{label('Yükleniyor…', 'Loading…')}</Text>}
      {query.isError && (
        <Button
          label={label('Tekrar dene', 'Retry')}
          onPress={() => {
            void query.refetch();
          }}
        />
      )}
      {form && (
        <OwnerActionForm
          key={`${form.path}:${form.title}`}
          action={form}
          access={access}
          close={() => setForm(null)}
          saved={async () => {
            await query.refetch();
            setForm(null);
          }}
        />
      )}
      {section === 'analytics' && metric.success && (
        <>
          {[
            [label('Kullanıcılar', 'Users'), metric.data.totals.users],
            [label('Sunucular', 'Servers'), metric.data.totals.servers],
            [label('Mesajlar', 'Messages'), metric.data.totals.messages],
            [label('Aktif oturumlar', 'Active sessions'), metric.data.totals.activeSessions],
          ].map(([name, value]) => (
            <Text key={name} style={{ color: colors.text, fontSize: 18 }}>
              {name}: {value}
            </Text>
          ))}
          {metric.data.daily.map((day) => (
            <View key={day.date} style={{ gap: 6 }}>
              <Text style={{ color: colors.textMuted }}>
                {day.date} · {day.newUsers} {label('yeni üye', 'new users')} · {day.messages}{' '}
                {label('mesaj', 'messages')}
              </Text>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: `${Math.max(1, (day.messages / Math.max(1, ...metric.data.daily.map((item) => item.messages))) * 100)}%`,
                  backgroundColor: colors.wave,
                }}
              />
            </View>
          ))}
        </>
      )}
      {section === 'cases' && (
        <>
          <Button
            label={label('Vaka oluştur', 'Create case')}
            onPress={() =>
              setForm({
                title: label('Vaka oluştur', 'Create case'),
                path: '/owner/cases',
                method: 'POST',
                schema: ownerAdminCaseCreateSchema,
                fields: [
                  { key: 'category', tr: 'Kategori', en: 'Category' },
                  { key: 'summary', tr: 'Özet', en: 'Summary' },
                  {
                    key: 'targetUserId',
                    tr: 'Kullanıcı kimliği (isteğe bağlı)',
                    en: 'User ID (optional)',
                  },
                  {
                    key: 'serverId',
                    tr: 'Sunucu kimliği (isteğe bağlı)',
                    en: 'Server ID (optional)',
                  },
                ],
              })
            }
          />
          {cases.success &&
            cases.data.map((item) => (
              <OwnerRecord
                key={item.id}
                title={`${item.caseNumber} · ${item.summary}`}
                detail={`${item.category} · ${item.status}`}
              >
                {item.notes.map((note) => (
                  <Text key={note.id} selectable style={{ color: colors.textMuted }}>
                    {note.body}
                  </Text>
                ))}
                {item.evidence.map((evidence) => (
                  <Text key={evidence.id} selectable style={{ color: colors.textMuted }}>
                    {evidence.originalName} · {evidence.description ?? evidence.externalUrl}
                  </Text>
                ))}
                <Button
                  label={label('Durumu güncelle', 'Update status')}
                  onPress={() =>
                    setForm({
                      title: item.caseNumber,
                      path: `/owner/cases/${item.id}`,
                      method: 'PATCH',
                      schema: ownerAdminCaseUpdateSchema,
                      fields: [
                        statusField(caseStatuses),
                        { key: 'resolution', tr: 'Karar', en: 'Resolution' },
                        {
                          key: 'assignedToId',
                          tr: 'Sorumlu kimliği (isteğe bağlı)',
                          en: 'Assignee ID (optional)',
                        },
                      ],
                    })
                  }
                />
                <Button
                  label={label('İç not', 'Internal note')}
                  onPress={() =>
                    setForm({
                      title: label('İç not', 'Internal note'),
                      path: `/owner/cases/${item.id}/notes`,
                      method: 'POST',
                      schema: ownerAdminCaseNoteSchema,
                      fields: [bodyField],
                    })
                  }
                />
                <Button
                  label={label('Yanıt gönder', 'Send reply')}
                  onPress={() =>
                    setForm({
                      title: label('Yanıt gönder', 'Send reply'),
                      path: `/owner/cases/${item.id}/reply`,
                      method: 'POST',
                      schema: ownerAdminCaseReplySchema,
                      fields: [bodyField],
                      confirm: true,
                    })
                  }
                />
                <Button
                  label={label('Kanıt ekle', 'Add evidence')}
                  onPress={() =>
                    setForm({
                      title: label('Kanıt ekle', 'Add evidence'),
                      path: `/owner/cases/${item.id}/evidence`,
                      method: 'POST',
                      schema: ownerAdminCaseEvidenceSchema,
                      fields: [
                        { key: 'originalName', tr: 'Ad', en: 'Name' },
                        { key: 'externalUrl', tr: 'Bağlantı', en: 'Link' },
                        { key: 'description', tr: 'Açıklama', en: 'Description' },
                      ],
                      fixed: { contentType: 'text/uri-list', size: 0 },
                    })
                  }
                />
              </OwnerRecord>
            ))}
        </>
      )}
      {section === 'appeals' && (
        <>
          <Button
            label={label('İtiraz oluştur', 'Create appeal')}
            onPress={() =>
              setForm({
                title: label('İtiraz oluştur', 'Create appeal'),
                path: '/owner/appeals',
                method: 'POST',
                schema: ownerAppealCreateSchema,
                fields: [
                  { key: 'caseId', tr: 'Vaka kimliği', en: 'Case ID' },
                  { key: 'userId', tr: 'Kullanıcı kimliği', en: 'User ID' },
                  reason,
                ],
              })
            }
          />
          {appeals.success &&
            appeals.data.map((item) => (
              <OwnerRecord key={item.id} title={item.reason} detail={item.status}>
                <Text style={{ color: colors.text }}>{item.response}</Text>
                <Button
                  label={label('Değerlendir', 'Review')}
                  onPress={() =>
                    setForm({
                      title: label('İtiraz kararı', 'Appeal decision'),
                      path: `/owner/appeals/${item.id}`,
                      method: 'PATCH',
                      schema: ownerAppealUpdateSchema,
                      fields: [
                        statusField(['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED']),
                        { key: 'response', tr: 'Yanıt', en: 'Response' },
                      ],
                    })
                  }
                />
              </OwnerRecord>
            ))}
        </>
      )}
      {section === 'risk-events' &&
        risks.success &&
        risks.data.map((item) => (
          <OwnerRecord
            key={item.id}
            title={item.reason}
            detail={`${item.type} · ${item.score}/100 · ${item.status}`}
          >
            <Button
              label={label('Değerlendir', 'Review')}
              onPress={() =>
                setForm({
                  title: label('Risk değerlendirmesi', 'Risk review'),
                  path: `/owner/risk-events/${item.id}`,
                  method: 'PATCH',
                  schema: ownerRiskEventUpdateSchema,
                  fields: [statusField(['OPEN', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE']), reason],
                })
              }
            />
          </OwnerRecord>
        ))}
      {section === 'ip-blocks' && (
        <>
          <Button
            label={label('Erişimi engelle', 'Block access')}
            onPress={() =>
              setForm({
                title: label('Erişimi engelle', 'Block access'),
                path: '/owner/ip-blocks',
                method: 'POST',
                schema: ownerIpBlockCreateSchema,
                fields: [
                  { key: 'ipHash', tr: 'IP özeti', en: 'IP hash' },
                  reason,
                  {
                    key: 'durationMinutes',
                    tr: 'Süre (dakika)',
                    en: 'Duration (minutes)',
                    number: true,
                  },
                ],
                confirm: true,
              })
            }
          />
          {blocks.success &&
            blocks.data.map((item) => (
              <OwnerRecord
                key={item.id}
                title={item.reason}
                detail={
                  item.expiresAt
                    ? new Date(item.expiresAt).toLocaleString(locale)
                    : label('Süresiz', 'Indefinite')
                }
              >
                <Text selectable style={{ color: colors.textMuted }}>
                  {item.ipHash}
                </Text>
                {!item.revokedAt && (
                  <Button
                    label={label('Engeli kaldır', 'Revoke block')}
                    onPress={() =>
                      setForm({
                        title: label('Engeli kaldır', 'Revoke block'),
                        path: `/owner/ip-blocks/${item.id}/revoke`,
                        method: 'POST',
                        schema: z.object({}),
                        fields: [],
                        confirm: true,
                      })
                    }
                  />
                )}
              </OwnerRecord>
            ))}
        </>
      )}
      {section === 'billing' &&
        billing.success &&
        billing.data.map((item) => (
          <OwnerRecord
            key={item.id}
            title={`${(item.amountMinor / 100).toFixed(2)} ${item.currency}`}
            detail={`${item.description ?? item.type} · ${item.status}`}
          >
            {item.status === 'COMPLETED' && (
              <Button
                variant="danger"
                label={label('İade et', 'Refund')}
                onPress={() =>
                  setForm({
                    title: label('İade et', 'Refund'),
                    path: `/owner/billing/${item.id}/refund`,
                    method: 'POST',
                    schema: ownerBillingRefundSchema,
                    fields: [reason],
                    fixed: { confirmation: 'REFUND' },
                    confirm: true,
                  })
                }
              />
            )}
          </OwnerRecord>
        ))}
      {query.isSuccess && Array.isArray(query.data) && query.data.length === 0 && (
        <Text>{label('Kayıt bulunamadı.', 'No records found.')}</Text>
      )}
    </View>
  );
}

function OwnerRecord({
  title,
  detail,
  children,
}: React.PropsWithChildren<{ title: string; detail: string }>) {
  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: colors.surface, borderRadius: 16 }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: colors.textMuted }}>{detail}</Text>
      {children}
    </View>
  );
}
export function OwnerActionForm({
  action,
  access,
  close,
  saved,
}: {
  action: Action;
  access: string;
  close(): void;
  saved(): Promise<void>;
}) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const input = {
        ...action.fixed,
        ...Object.fromEntries(
          action.fields
            .filter((field) => values[field.key]?.trim())
            .map((field) => [
              field.key,
              field.number ? Number(values[field.key]) : values[field.key],
            ]),
        ),
      };
      const parsed = action.schema.safeParse(input);
      if (!parsed.success) {
        setError(tr ? 'Alanları kontrol et.' : 'Check the fields.');
        return;
      }
      await api.request(action.path, {
        method: action.method,
        headers: { 'X-Wapve-Owner-Access': access },
        body: parsed.data,
      });
      await saved();
    } catch {
      setError(
        tr
          ? 'İşlem başarısız. Yetkini ve oturumunu kontrol et.'
          : 'Action failed. Check your permissions and session.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ padding: 16, gap: 12, backgroundColor: colors.surfaceRaised, borderRadius: 16 }}>
      <Text style={{ color: colors.text, fontSize: 20 }}>{action.title}</Text>
      {action.fields.map((field) =>
        field.options ? (
          <View key={field.key} style={{ gap: 8 }}>
            <Text>{tr ? field.tr : field.en}</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {field.options.map((option) => (
                <Button
                  key={option}
                  label={option.replaceAll('_', ' ')}
                  variant={values[field.key] === option ? 'primary' : 'secondary'}
                  onPress={() => setValues((current) => ({ ...current, [field.key]: option }))}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <Field
            key={field.key}
            label={tr ? field.tr : field.en}
            value={values[field.key] ?? ''}
            onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
            keyboardType={field.number ? 'number-pad' : 'default'}
            multiline={!field.number}
          />
        ),
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      <Button
        label={tr ? 'Uygula' : 'Apply'}
        loading={busy}
        onPress={() =>
          action.confirm
            ? Alert.alert(action.title, tr ? 'Bu işlem uygulansın mı?' : 'Apply this action?', [
                { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
                {
                  text: tr ? 'Uygula' : 'Apply',
                  onPress: () => {
                    void submit();
                  },
                },
              ])
            : void submit()
        }
      />
      <Button variant="ghost" label={tr ? 'Kapat' : 'Close'} onPress={close} />
    </View>
  );
}
