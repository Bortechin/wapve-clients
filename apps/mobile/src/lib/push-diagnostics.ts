export type PushFailureStage = 'permission' | 'token' | 'server';

function message(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'Bilinmeyen hata';
}

export function classifyPushFailure(stage: PushFailureStage, error: unknown) {
  const detail = message(error);
  if (stage === 'permission') {
    return { phase: 'permission_error' as const, detail: `Bildirim izni okunamadı: ${detail}` };
  }
  if (stage === 'token') {
    const firebaseHint = /firebase|google-services|default firebaseapp|fcm/iu.test(detail)
      ? ' Firebase istemci yapılandırmasını (google-services.json) kontrol et.'
      : '';
    return { phase: 'token_error' as const, detail: `FCM token alınamadı: ${detail}.${firebaseHint}` };
  }
  return { phase: 'server_error' as const, detail: `Token sunucuya kaydedilemedi: ${detail}` };
}
