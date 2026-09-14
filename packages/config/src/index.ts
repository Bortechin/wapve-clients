export const PRODUCT_NAME = 'Wapve';
export const SUPPORTED_LOCALES = ['tr', 'en'] as const;
export const DEFAULT_LOCALE = 'tr' as const;

export const securityLimits = {
  passwordMin: 9,
  passwordMax: 32,
  passwordAuthenticationMax: 128,
  minimumRegistrationAge: 13,
  maximumRegistrationAge: 120,
  socialCooldownMinutes: 10,
  usernameMin: 3,
  usernameMax: 32,
  displayNameMax: 32,
  avatarBytes: 5 * 1024 * 1024,
  serverEmojiBytes: 256 * 1024,
  soundboardBytes: 8 * 1024 * 1024,
  attachmentBytes: 25 * 1024 * 1024,
  usernameCooldownDays: 30,
  sessionDays: 30,
  verificationHours: 24,
  passwordResetMinutes: 30,
} as const;

export const colors = {
  background: '#0B0F14',
  sidebar: '#0F141B',
  surface: '#151B23',
  hover: '#1C2530',
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  success: '#22C55E',
  danger: '#EF4444',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
} as const;
