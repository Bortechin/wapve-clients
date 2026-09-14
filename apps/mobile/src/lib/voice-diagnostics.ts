import type { VoiceDiagnostic } from '@wapve/contracts';
import { api } from './client';

export function diagnosticErrorName(error: unknown): string | undefined {
  const raw = error instanceof Error ? error.name : typeof error === 'string' ? error : '';
  const safe = raw.replace(/[^A-Za-z0-9]/gu, '').slice(0, 64);
  return /^[A-Za-z]/u.test(safe) ? safe : undefined;
}

export function reportVoiceDiagnostic(diagnostic: VoiceDiagnostic): void {
  void api.request<void>('/voice/diagnostics', {
    method: 'POST',
    body: diagnostic,
  }).catch(() => undefined);
}
