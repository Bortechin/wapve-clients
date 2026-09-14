import { z } from 'zod';
import { localeSchema } from './common.js';
import { mobilePlatformSchema } from './auth.js';

export const registerDeviceInstallationSchema = z.object({
  platform: mobilePlatformSchema,
  token: z.string().trim().min(32).max(4096),
  deviceName: z.string().trim().min(1).max(120),
  appVersion: z.string().trim().min(1).max(40),
  locale: localeSchema,
});

export type RegisterDeviceInstallationInput = z.infer<
  typeof registerDeviceInstallationSchema
>;

export const deviceInstallationSummarySchema = z.object({
  id: z.string().uuid(),
  platform: mobilePlatformSchema,
  deviceName: z.string(),
  appVersion: z.string(),
  locale: localeSchema,
  lastSeenAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const deviceInstallationStatusSchema = z.object({
  registered: z.boolean(),
  installation: deviceInstallationSummarySchema.nullable(),
});

export type DeviceInstallationStatus = z.infer<typeof deviceInstallationStatusSchema>;
