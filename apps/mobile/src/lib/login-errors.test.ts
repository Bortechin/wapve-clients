import { expect, it } from '@jest/globals';
import { ApiError } from '@wapve/api-client';
import { loginErrorMessage, normalizeLoginIdentifier } from './login-errors';

it('normalizes username handles but preserves email identifiers', () => {
  expect(normalizeLoginIdentifier(' @wawe ')).toBe('wawe');
  expect(normalizeLoginIdentifier(' test@example.com ')).toBe('test@example.com');
});
it('translates server errors, including the legacy typo, without exposing raw keys', () => {
  for (const key of ['errors.invalidCredentials', 'errors.invalidCredentails']) {
    expect(loginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', key), 'tr')).toBe('E-posta, kullanıcı adı veya şifre hatalı.');
    expect(loginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', key), 'en')).not.toContain('errors.');
  }
  expect(loginErrorMessage(new ApiError(500, 'UNKNOWN', 'errors.missing'), 'tr')).not.toContain('errors.');
});
it('distinguishes missing credentials from cancellation and API rejection', () => {
  expect(loginErrorMessage({ code: 'PASSKEY_NO_CREDENTIAL' }, 'en', true)).toContain('provider');
  expect(loginErrorMessage({ code: 'PASSKEY_CANCELLED' }, 'en', true)).toContain('closed');
  expect(loginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'errors.invalidCredentials'), 'tr', true)).toBe('E-posta, kullanıcı adı veya şifre hatalı.');
});
