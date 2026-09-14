import { ApiClientError } from './api';
import type { Dictionary } from './i18n';

export function errorMessage(error: unknown, messages: Dictionary): string {
  if (!(error instanceof ApiClientError)) return messages.genericError;
  if (error.details.code === 'AUTOMOD_BLOCKED') {
    const reason = error.details.messageKey.replace(/^automod\./, '');
    const events = messages.automodEvents as Record<string, string>;
    return events[`AUTOMOD_${reason}`] ?? messages.automodActionApplied;
  }
  const fieldMessageKey = error.details.fieldErrors?.[0]?.messageKey;
  if (fieldMessageKey?.startsWith('validation.')) {
    const fieldKey = fieldMessageKey.slice('validation.'.length);
    const validation = messages.validation as Record<string, string>;
    if (validation[fieldKey]) return validation[fieldKey];
  }
  const key = error.details.messageKey.replace(/^errors\./, '');
  const known = messages.errors as Record<string, string>;
  return known[key] ?? messages.genericError;
}
