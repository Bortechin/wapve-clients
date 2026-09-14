import { describe, expect, it } from 'vitest';
import {
  beginPasskeyRegistrationSchema,
  birthDateSchema,
  displayNameSchema,
  finishPasskeyAuthenticationSchema,
  passwordSchema,
  registerSchema,
  usernameSchema,
} from './auth.js';

describe('identity contracts', () => {
  it('normalizes a valid username', () => {
    expect(usernameSchema.parse('  Wapve.User_1  ')).toBe('wapve.user_1');
  });

  it.each(['.wapve', 'wapve.', 'wa..pve', 'şüpheli', 'a'])('rejects username %s', (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });

  it('allows Turkish display names and rejects bidi overrides', () => {
    expect(displayNameSchema.parse('Çağrı Şahin')).toBe('Çağrı Şahin');
    expect(displayNameSchema.safeParse('safe\u202Eevil').success).toBe(false);
  });

  it('requires new passwords to contain 9 through 32 characters', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('123456789').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(32)).success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(33)).success).toBe(false);
  });

  it('validates real birth dates and the 13 to 120 age range', () => {
    expect(birthDateSchema.safeParse('2000-02-29').success).toBe(true);
    expect(birthDateSchema.safeParse('2001-02-29').success).toBe(false);
    expect(birthDateSchema.safeParse('2999-01-01').success).toBe(false);
    expect(birthDateSchema.safeParse('1800-01-01').success).toBe(false);
  });

  it('accepts public registration without an alpha key and discards legacy invite fields', () => {
    const registration = registerSchema.parse({
      email: 'new@wapve.com',
      username: 'new.wave',
      displayName: 'New Wave',
      password: 'a secure public password',
      birthDate: '2000-02-29',
      locale: 'en',
      alphaInviteCode: 'LEGACY-ALPHA-KEY',
    });

    expect(registration).not.toHaveProperty('alphaInviteCode');
  });

  it('bounds passkey names and rejects malformed WebAuthn payloads', () => {
    expect(
      beginPasskeyRegistrationSchema.parse({
        currentPassword: 'current password',
        name: '  Dizüstü  ',
      }),
    ).toMatchObject({ name: 'Dizüstü' });
    expect(
      finishPasskeyAuthenticationSchema.safeParse({
        challengeId: '018f0d7a-91ab-7abc-8def-0123456789ab',
        response: {
          id: '../not-base64url',
          rawId: 'valid-base64url',
          type: 'public-key',
          clientExtensionResults: {},
          response: {
            clientDataJSON: 'e30',
            authenticatorData: 'e30',
            signature: 'e30',
          },
        },
      }).success,
    ).toBe(false);
  });
});
