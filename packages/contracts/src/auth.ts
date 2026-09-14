import { securityLimits } from '@wapve/config';
import { z } from 'zod';
import { localeSchema } from './common.js';

const blockedDirectionalCharacters = /[\u202A-\u202E\u2066-\u2069]/u;
function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(securityLimits.passwordMin, 'validation.passwordTooShort')
  .max(securityLimits.passwordMax, 'validation.passwordTooLong');

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'validation.birthDateInvalid')
  .superRefine((value, context) => {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      context.addIssue({ code: 'custom', message: 'validation.birthDateInvalid' });
      return;
    }
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (date > todayUtc) {
      context.addIssue({ code: 'custom', message: 'validation.birthDateFuture' });
      return;
    }
    let age = todayUtc.getUTCFullYear() - year;
    const birthdayPassed =
      todayUtc.getUTCMonth() > month - 1 ||
      (todayUtc.getUTCMonth() === month - 1 && todayUtc.getUTCDate() >= day);
    if (!birthdayPassed) age -= 1;
    if (age < securityLimits.minimumRegistrationAge) {
      context.addIssue({ code: 'custom', message: 'validation.minimumAge' });
    } else if (age > securityLimits.maximumRegistrationAge) {
      context.addIssue({ code: 'custom', message: 'validation.maximumAge' });
    }
  });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(securityLimits.usernameMin, 'validation.usernameTooShort')
  .max(securityLimits.usernameMax, 'validation.usernameTooLong')
  .regex(/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/u, 'validation.usernameFormat')
  .refine((value) => !value.includes('..'), 'validation.usernameFormat');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.displayNameRequired')
  .max(securityLimits.displayNameMax, 'validation.displayNameTooLong')
  .refine((value) => !hasControlCharacters(value), 'validation.displayNameControlCharacters')
  .refine((value) => !blockedDirectionalCharacters.test(value), 'validation.displayNameDirection');

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  locale: localeSchema,
});

export const inviteRegisterSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_+-]{4,64}$/u, 'validation.invalidServerInvite'),
  username: usernameSchema,
  displayName: displayNameSchema,
  birthDate: birthDateSchema,
  locale: localeSchema,
  turnstileToken: z.string().min(1).max(2048),
});

export const claimAccountSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
  deviceId: z.string().uuid().optional(),
});

export const addSwitcherAccountSchema = loginSchema.extend({
  code: z.string().trim().min(6).max(32).optional(),
});
export const switchAccountSchema = z.object({ userId: z.string().uuid() });
export const switcherAccountSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{11}$/u),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  current: z.boolean(),
});
export const switcherAccountsSchema = z.object({
  accounts: z.array(switcherAccountSchema).max(2),
  maxAccounts: z.literal(2),
});

export const mobilePlatformSchema = z.enum(['ANDROID', 'IOS']);
export const mobileLoginSchema = loginSchema.extend({
  platform: mobilePlatformSchema.default('ANDROID'),
});
export const mobileRegisterSchema = registerSchema.extend({
  platform: mobilePlatformSchema.default('ANDROID'),
});
export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(32).max(256),
});

export const qrLoginChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  token: z.string().min(32).max(256),
});
export const qrLoginRedeemSchema = z.object({
  challengeId: z.string().uuid(),
  pollToken: z.string().min(32).max(256),
});

export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(32).max(256),
});

export const loginLocationConfirmSchema = z.object({
  token: z.string().min(32).max(256),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
  newPassword: passwordSchema,
});

export const twoFactorCodeSchema = z.string().trim().min(6).max(32);
export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(32).max(256),
  code: twoFactorCodeSchema,
  deviceId: z.string().uuid().optional(),
});
export const mobileTwoFactorLoginSchema = twoFactorLoginSchema.extend({
  platform: mobilePlatformSchema.default('ANDROID'),
});
export const twoFactorSetupSchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
});
export const twoFactorEnableSchema = z.object({
  setupToken: z.string().min(32).max(256),
  code: twoFactorCodeSchema,
});
export const twoFactorDisableSchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
  code: twoFactorCodeSchema,
});
export const twoFactorRecoveryCodesSchema = twoFactorDisableSchema;

const base64UrlValueSchema = z
  .string()
  .min(1)
  .max(2_000_000)
  .regex(/^[A-Za-z0-9_-]+$/u, 'validation.invalidPasskeyPayload');
const authenticatorTransportSchema = z.enum([
  'ble',
  'cable',
  'hybrid',
  'internal',
  'nfc',
  'smart-card',
  'usb',
]);

export const passkeyNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.passkeyNameRequired')
  .max(64, 'validation.passkeyNameTooLong');

export const beginPasskeyRegistrationSchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
  name: passkeyNameSchema,
});

export const passkeyRegistrationResponseSchema = z
  .object({
    id: base64UrlValueSchema,
    rawId: base64UrlValueSchema,
    type: z.literal('public-key'),
    authenticatorAttachment: z.enum(['cross-platform', 'platform']).nullable().optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
    response: z.object({
      clientDataJSON: base64UrlValueSchema,
      attestationObject: base64UrlValueSchema,
      transports: z.array(authenticatorTransportSchema).max(16).optional(),
      publicKeyAlgorithm: z.number().int().optional(),
      publicKey: base64UrlValueSchema.optional(),
      authenticatorData: base64UrlValueSchema.optional(),
    }),
  })
  .strict();

export const finishPasskeyRegistrationSchema = z.object({
  challengeId: z.string().uuid(),
  name: passkeyNameSchema,
  response: passkeyRegistrationResponseSchema,
});

export const passkeyAuthenticationResponseSchema = z
  .object({
    id: base64UrlValueSchema,
    rawId: base64UrlValueSchema,
    type: z.literal('public-key'),
    authenticatorAttachment: z.enum(['cross-platform', 'platform']).nullable().optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
    response: z.object({
      clientDataJSON: base64UrlValueSchema,
      authenticatorData: base64UrlValueSchema,
      signature: base64UrlValueSchema,
      userHandle: base64UrlValueSchema.nullable().optional(),
    }),
  })
  .strict();

export const finishPasskeyAuthenticationSchema = z.object({
  challengeId: z.string().uuid(),
  response: passkeyAuthenticationResponseSchema,
});
export const mobileFinishPasskeyAuthenticationSchema = finishPasskeyAuthenticationSchema.extend({
  platform: mobilePlatformSchema.default('ANDROID'),
});

export const deletePasskeySchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type InviteRegisterInput = z.infer<typeof inviteRegisterSchema>;
export type ClaimAccountInput = z.infer<typeof claimAccountSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddSwitcherAccountInput = z.infer<typeof addSwitcherAccountSchema>;
export type SwitchAccountInput = z.infer<typeof switchAccountSchema>;
export type SwitcherAccount = z.infer<typeof switcherAccountSchema>;
export type SwitcherAccounts = z.infer<typeof switcherAccountsSchema>;
export type MobileLoginInput = z.infer<typeof mobileLoginSchema>;
export type MobileRegisterInput = z.infer<typeof mobileRegisterSchema>;
export type MobileTwoFactorLoginInput = z.infer<typeof mobileTwoFactorLoginSchema>;
export type MobileRefreshInput = z.infer<typeof mobileRefreshSchema>;
export type QrLoginChallengeInput = z.infer<typeof qrLoginChallengeSchema>;
export type QrLoginRedeemInput = z.infer<typeof qrLoginRedeemSchema>;
export type EmailVerificationConfirmInput = z.infer<typeof emailVerificationConfirmSchema>;
export type LoginLocationConfirmInput = z.infer<typeof loginLocationConfirmSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
export type TwoFactorRecoveryCodesInput = z.infer<typeof twoFactorRecoveryCodesSchema>;
export type BeginPasskeyRegistrationInput = z.infer<typeof beginPasskeyRegistrationSchema>;
export type FinishPasskeyRegistrationInput = z.infer<typeof finishPasskeyRegistrationSchema>;
export type FinishPasskeyAuthenticationInput = z.infer<typeof finishPasskeyAuthenticationSchema>;
export type MobileFinishPasskeyAuthenticationInput = z.infer<
  typeof mobileFinishPasskeyAuthenticationSchema
>;
export type DeletePasskeyInput = z.infer<typeof deletePasskeySchema>;
