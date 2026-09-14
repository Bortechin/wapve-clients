import { Text, Alert, Pressable, Switch } from '@/components/localized-native';
import type { MobileTokens } from '@wapve/api-client';
import type { UserProfile } from '@wapve/contracts';
import {
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import { colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import * as Clipboard from 'expo-clipboard';
import { useState,
  type ReactNode } from 'react';
import {
  Share,
  StyleSheet,
  View,
} from '@/components/themed-native';
import QRCode from 'react-native-qrcode-svg';
import WapveCredentials from '../../modules/wapve-credentials';
import { api } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { secureTokenStorage } from '@/lib/session-storage';
import { useDeveloperMode } from '@/lib/developer-mode';
import { Button, Field } from './ui';
import { Icon } from './icon';

type Passkey = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

type TwoFactorSetup = {
  setupToken: string;
  manualKey: string;
  otpauthUrl: string;
  expiresAt: string;
};

type RotatedSession = MobileTokens & { user: UserProfile; recoveryCodes?: string[] };

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.replaceAll('_', ' ').toLocaleLowerCase('tr');
  }
  return 'İşlem tamamlanamadı. Bilgileri kontrol edip yeniden dene.';
}

export function AccountSecuritySettings() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [managePassword, setManagePassword] = useState('');
  const [manageCode, setManageCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [passkeyName, setPasskeyName] = useState('Galaxy passkey');
  const [passkeyPassword, setPasskeyPassword] = useState('');
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);
  const [removePasskeyPassword, setRemovePasskeyPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionCode, setDeletionCode] = useState('');
  const { enabled: developerMode, ready: developerModeReady, setEnabled: setDeveloperMode } = useDeveloperMode();
  const status = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => api.request<{ enabled: boolean }>('/auth/2fa/status'),
  });
  const passkeys = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => api.request<Passkey[]>('/auth/passkeys'),
  });

  function begin() {
    setError('');
    setNotice('');
    setBusy(true);
    void api
      .request<TwoFactorSetup>('/auth/2fa/setup', {
        method: 'POST',
        body: { currentPassword: setupPassword },
      })
      .then((value) => {
        setSetup(value);
        setSetupPassword('');
      })
      .catch((caught) => setError(errorText(caught)))
      .finally(() => setBusy(false));
  }
  async function acceptRotation(result: RotatedSession) {
    await secureTokenStorage.save(result);
    await Promise.all([
      refreshUser(),
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] }),
      queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    ]);
  }
  async function enableTwoFactor() {
    if (!setup) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.request<RotatedSession>('/auth/mobile/2fa/enable', {
        method: 'POST',
        body: { setupToken: setup.setupToken, code: twoFactorCode },
      });
      await acceptRotation(result);
      setRecoveryCodes(result.recoveryCodes ?? []);
      setSetup(null);
      setTwoFactorCode('');
      setNotice('İki adımlı doğrulama etkinleştirildi. Kurtarma kodlarını güvenli bir yere kaydet.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function manageTwoFactor(operation: 'disable' | 'recovery') {
    setBusy(true);
    setError('');
    try {
      const result = await api.request<RotatedSession>(
        operation === 'disable'
          ? '/auth/mobile/2fa/disable'
          : '/auth/mobile/2fa/recovery-codes',
        {
          method: 'POST',
          body: { currentPassword: managePassword, code: manageCode },
        },
      );
      await acceptRotation(result);
      if (operation === 'recovery') {
        setRecoveryCodes(result.recoveryCodes ?? []);
        setNotice('Yeni kurtarma kodları üretildi; eski kodlar artık geçersiz.');
      } else {
        setRecoveryCodes(null);
        setNotice('İki adımlı doğrulama kapatıldı.');
      }
      setManagePassword('');
      setManageCode('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function createPasskey() {
    if (!passkeyPassword || !passkeyName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const challenge = await api.request<{ challengeId: string; options: unknown }>(
        '/auth/passkeys/register/options',
        {
          method: 'POST',
          body: { currentPassword: passkeyPassword, name: passkeyName.trim() },
        },
      );
      const response = JSON.parse(
        await WapveCredentials.createPasskey(JSON.stringify(challenge.options)),
      ) as unknown;
      await api.request('/auth/passkeys/register/verify', {
        method: 'POST',
        body: { challengeId: challenge.challengeId, name: passkeyName.trim(), response },
      });
      setPasskeyPassword('');
      setNotice('Passkey bu cihaza eklendi.');
      await passkeys.refetch();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function removePasskey() {
    if (!removingPasskeyId || !removePasskeyPassword) return;
    setBusy(true);
    setError('');
    try {
      await api.request(`/auth/passkeys/${removingPasskeyId}`, {
        method: 'DELETE',
        body: { currentPassword: removePasskeyPassword },
      });
      setRemovingPasskeyId(null);
      setRemovePasskeyPassword('');
      setNotice('Passkey kaldırıldı.');
      await passkeys.refetch();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function changePassword() {
    setBusy(true);
    setError('');
    try {
      const result = await api.request<RotatedSession>('/auth/mobile/password/change', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      await acceptRotation(result);
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Parola değiştirildi ve diğer oturumlar kapatıldı.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function requestDeletion() {
    setBusy(true);
    setError('');
    try {
      await api.request<UserProfile>('/users/me/deletion', {
        method: 'POST',
        body: {
          currentPassword: deletionPassword,
          ...(user?.twoFactorEnabled ? { code: deletionCode } : {}),
          confirmation: 'DELETE',
        },
      });
      setDeletionPassword('');
      setDeletionCode('');
      await refreshUser();
      setNotice('14 günlük hesap silme süreci başlatıldı.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function cancelDeletion() {
    await api.request('/users/me/deletion', { method: 'DELETE' });
    await refreshUser();
    setNotice('Hesap silme isteği iptal edildi.');
  }
  function confirmDeletion() {
    Alert.alert(
      'Hesap silme sürecini başlat',
      '14 gün sonunda profil anonimleştirilir ve tüm oturumlar kapatılır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Süreci başlat', style: 'destructive', onPress: () => void requestDeletion() },
      ],
    );
  }
  const enabled = status.data?.enabled ?? user?.twoFactorEnabled ?? false;
  return (
    <View style={styles.stack}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {!user?.emailVerified ? (
        <Card title="E-POSTA DOĞRULAMA" icon="email-alert-outline">
          <Text style={styles.body}>Hesabın doğrulanmadı. Mesaj ve sunucu işlemleri için e-postanı doğrula.</Text>
          <Button
            label="Doğrulama e-postasını yeniden gönder"
            variant="secondary"
            onPress={() =>
              void api
                .request('/auth/email-verification/resend', { method: 'POST', body: {} })
                .then(() => setNotice('Doğrulama e-postası gönderildi.'))
            }
          />
        </Card>
      ) : null}
      <Card title="İKİ ADIMLI DOĞRULAMA" icon={enabled ? 'shield-check-outline' : 'shield-key-outline'}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, enabled && styles.statusDotEnabled]} />
          <Text style={styles.name}>{enabled ? 'Etkin' : 'Etkin değil'}</Text>
        </View>
        <Text style={styles.body}>
          {enabled
            ? 'Giriş sırasında doğrulayıcı uygulama veya kurtarma kodu istenir.'
            : 'Parolan ele geçirilse bile hesabını doğrulayıcı koduyla koru.'}
        </Text>
        {!enabled && !setup ? (
          <>
            <Field
              label="Mevcut parola"
              value={setupPassword}
              onChangeText={setSetupPassword}
              secureTextEntry
            />
            <Button
              label="2FA kurulumunu başlat"
              disabled={!setupPassword}
              loading={busy}
              onPress={begin}
            />
          </>
        ) : null}
        {setup ? (
          <View style={styles.setupFlow}>
            <Text style={styles.step}>1 · QR kodunu doğrulayıcı uygulamanla tara</Text>
            <View style={styles.qrWrap}>
              <QRCode value={setup.otpauthUrl} size={190} color="#081225" backgroundColor="#ffffff" />
            </View>
            <Text style={styles.label}>ELLE KURULUM ANAHTARI</Text>
            <Pressable
              style={styles.manualKey}
              onPress={() => void Clipboard.setStringAsync(setup.manualKey)}
            >
              <Text selectable style={styles.manualKeyText}>
                {setup.manualKey.match(/.{1,4}/gu)?.join(' ')}
              </Text>
              <Icon name="content-copy" color={colors.waveBright} size={20} />
            </Pressable>
            <Text style={styles.step}>2 · Uygulamadaki 6 haneli kodu gir</Text>
            <Field
              label="Doğrulama kodu"
              value={twoFactorCode}
              onChangeText={setTwoFactorCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={styles.actions}>
              <Button label="Vazgeç" variant="secondary" onPress={() => setSetup(null)} />
              <Button
                label="Etkinleştir"
                disabled={twoFactorCode.length !== 6}
                loading={busy}
                onPress={() => void enableTwoFactor()}
              />
            </View>
          </View>
        ) : null}
        {enabled ? (
          <>
            <Field
              label="Mevcut parola"
              value={managePassword}
              onChangeText={setManagePassword}
              secureTextEntry
            />
            <Field
              label="2FA veya kurtarma kodu"
              value={manageCode}
              onChangeText={setManageCode}
              maxLength={32}
            />
            <Button
              label="Kurtarma kodlarını yenile"
              variant="secondary"
              disabled={!managePassword || manageCode.length < 6}
              loading={busy}
              onPress={() => void manageTwoFactor('recovery')}
            />
            <Button
              label="2FA’yı kapat"
              variant="danger"
              disabled={!managePassword || manageCode.length < 6}
              loading={busy}
              onPress={() => void manageTwoFactor('disable')}
            />
          </>
        ) : null}
        {recoveryCodes ? (
          <View style={styles.recoveryPanel}>
            <Text style={styles.name}>Kurtarma kodlarını şimdi kaydet</Text>
            <Text style={styles.body}>Her kod yalnız bir kez kullanılır ve daha sonra tekrar gösterilmez.</Text>
            <View style={styles.recoveryGrid}>
              {recoveryCodes.map((code) => <Text key={code} style={styles.recoveryCode}>{code}</Text>)}
            </View>
            <View style={styles.actions}>
              <Button
                label="Kopyala"
                variant="secondary"
                onPress={() => void Clipboard.setStringAsync(recoveryCodes.join('\n'))}
              />
              <Button
                label="Paylaş"
                variant="secondary"
                onPress={() => void Share.share({ message: `Wapve kurtarma kodları\n\n${recoveryCodes.join('\n')}` })}
              />
            </View>
          </View>
        ) : null}
      </Card>
      <Card title={`PASSKEY’LER · ${passkeys.data?.length ?? 0}`} icon="fingerprint">
        <Text style={styles.body}>Ekran kilidiyle korunan, kimlik avına dayanıklı giriş anahtarları.</Text>
        {passkeys.data?.map((passkey) => (
          <View key={passkey.id} style={styles.passkeyRow}>
            <View style={styles.passkeyIcon}>
              <Icon name="key-variant" color={colors.waveBright} size={23} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>{passkey.name}</Text>
              <Text style={styles.meta}>
                {passkey.backedUp ? 'Senkronize' : 'Bu cihazda'} · {passkey.deviceType}
              </Text>
              <Text style={styles.meta}>
                {passkey.lastUsedAt
                  ? `Son kullanım ${new Date(passkey.lastUsedAt).toLocaleString('tr-TR')}`
                  : `Oluşturma ${new Date(passkey.createdAt).toLocaleString('tr-TR')}`}
              </Text>
            </View>
            <Pressable
              style={styles.iconButton}
              onPress={() => setRemovingPasskeyId(passkey.id)}
              accessibilityLabel="Passkey kaldır"
            >
              <Icon name="trash-can-outline" color={colors.danger} size={22} />
            </Pressable>
          </View>
        ))}
        {removingPasskeyId ? (
          <View style={styles.inlineDanger}>
            <Field
              label="Kaldırmak için mevcut parola"
              value={removePasskeyPassword}
              onChangeText={setRemovePasskeyPassword}
              secureTextEntry
            />
            <View style={styles.actions}>
              <Button
                label="Vazgeç"
                variant="secondary"
                onPress={() => setRemovingPasskeyId(null)}
              />
              <Button
                label="Passkey’i kaldır"
                variant="danger"
                disabled={!removePasskeyPassword}
                loading={busy}
                onPress={() => void removePasskey()}
              />
            </View>
          </View>
        ) : null}
        <Field label="Passkey adı" value={passkeyName} onChangeText={setPasskeyName} maxLength={64} />
        <Field
          label="Mevcut parola"
          value={passkeyPassword}
          onChangeText={setPasskeyPassword}
          secureTextEntry
        />
        <Button
          label="Bu cihazda passkey oluştur"
          disabled={!passkeyPassword || !passkeyName.trim()}
          loading={busy}
          onPress={() => void createPasskey()}
        />
      </Card>
      <Card title="PAROLA" icon="lock-reset">
        <Field
          label="Mevcut parola"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Field
          label="Yeni parola"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Button
          label="Parolayı değiştir"
          disabled={!currentPassword || newPassword.length < 12}
          loading={busy}
          onPress={() => void changePassword()}
        />
      </Card>
      <Card title="GELİŞTİRİCİ SEÇENEKLERİ" icon="code-tags">
        <View style={styles.toggleRow}>
          <View style={styles.copy}>
            <Text style={styles.name}>Geliştirici modu</Text>
            <Text style={styles.meta}>Kopyalanabilir teknik kimlikleri gösterir.</Text>
          </View>
          <Switch
            accessibilityLabel="Geliştirici modu"
            value={developerMode}
            disabled={!developerModeReady}
            onValueChange={(value) => void setDeveloperMode(value)}
          />
        </View>
        {developerMode && user ? (
          <Pressable style={styles.manualKey} onPress={() => void Clipboard.setStringAsync(user.publicId)}>
            <View style={styles.copy}>
              <Text style={styles.label}>KULLANICI KİMLİĞİ</Text>
              <Text selectable style={styles.manualKeyText}>{user.publicId}</Text>
            </View>
            <Icon name="content-copy" color={colors.waveBright} size={20} />
          </Pressable>
        ) : null}
      </Card>
      <Card title="TEHLİKELİ BÖLGE" icon="alert-outline" danger>
        {user?.deletionScheduledFor ? (
          <>
            <Text style={styles.body}>
              Hesabın {new Date(user.deletionScheduledFor).toLocaleString('tr-TR')} tarihinde silinecek.
            </Text>
            <Button label="Silme isteğini iptal et" variant="secondary" onPress={() => void cancelDeletion()} />
          </>
        ) : (
          <>
            <Text style={styles.body}>14 gün sonra profil anonimleştirilir ve tüm oturumların kapatılır.</Text>
            <Field
              label="Mevcut parola"
              value={deletionPassword}
              onChangeText={setDeletionPassword}
              secureTextEntry
            />
            {user?.twoFactorEnabled ? (
              <Field
                label="2FA kodu"
                value={deletionCode}
                onChangeText={setDeletionCode}
                maxLength={32}
              />
            ) : null}
            <Button
              label="14 günlük silme sürecini başlat"
              variant="danger"
              disabled={!deletionPassword || Boolean(user?.twoFactorEnabled && deletionCode.length < 6)}
              onPress={confirmDeletion}
            />
          </>
        )}
      </Card>
    </View>
  );
}

function Card({
  title,
  icon,
  danger,
  children,
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]['name'];
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, danger && styles.dangerCard]}>
      <View style={styles.cardHead}>
        <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={22} />
        <Text style={[styles.label, danger && styles.dangerText]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  dangerCard: { borderColor: 'rgba(239,68,68,.45)' },
  cardHead: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  dangerText: { color: colors.danger },
  name: { color: colors.text, ...typography.heading },
  body: { color: colors.textMuted, ...typography.body },
  meta: { color: colors.textDim, ...typography.caption },
  copy: { flex: 1 },
  error: { color: colors.danger, ...typography.body, padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(239,68,68,.12)' },
  notice: { color: colors.success, ...typography.body, padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(34,197,94,.12)' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.textDim },
  statusDotEnabled: { backgroundColor: colors.success },
  setupFlow: { gap: spacing.sm },
  step: { color: colors.text, ...typography.label },
  qrWrap: { alignSelf: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: '#ffffff' },
  manualKey: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
  },
  manualKeyText: { flex: 1, color: colors.text, ...typography.body, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  recoveryPanel: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  recoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  recoveryCode: { width: '48%', color: colors.text, fontFamily: 'monospace', fontSize: 14 },
  passkeyRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  passkeyIcon: { width: 38, alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inlineDanger: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,.4)' },
  toggleRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
