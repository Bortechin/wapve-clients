import { z } from 'zod';
import { emailSchema, passwordSchema, twoFactorCodeSchema } from './auth.js';
import { serverDescriptionSchema, serverNameSchema } from './server.js';
import { platformBadgeSchema, platformStaffRoleSchema } from './common.js';
export const userReportCategorySchema = z.enum(['BUG', 'FEEDBACK', 'SAFETY', 'OTHER']);
export const userReportStatusSchema = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);

const reportPageUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Report page URL must use HTTP or HTTPS without embedded credentials');

export const createUserReportSchema = z.object({
  category: userReportCategorySchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  pageUrl: reportPageUrlSchema.optional(),
  context: z
    .object({
      viewport: z.string().max(40).optional(),
      userAgent: z.string().max(512).optional(),
      lastErrorCode: z.string().max(80).optional(),
      reportedUserId: z.string().uuid().optional(),
    })
    .strict()
    .optional(),
});

export const ownerUnlockSchema = z.object({
  currentPassword: passwordSchema,
  code: twoFactorCodeSchema,
});

export const ownerUserSearchSchema = z.object({
  query: z.string().trim().min(2).max(254),
});

export const ownerUsersQuerySchema = z.object({
  q: z.string().trim().max(254).optional(),
  status: z.enum(['ALL', 'ACTIVE', 'SUSPENDED', 'DELETED', 'MUTED']).default('ALL'),
  badge: platformBadgeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ownerServersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  state: z
    .enum(['ALL', 'DISCOVERABLE', 'FEATURED', 'VERIFIED', 'SUSPENDED', 'DELETED'])
    .default('ALL'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const ownerSanctionSchema = z.object({
  reason: z.string().trim().min(3).max(512),
  durationMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
});
export const ownerAlphaBadgeSchema = z.object({ enabled: z.boolean() });
export const ownerBadgeAssignmentSchema = z.object({
  badge: platformBadgeSchema.exclude(['PLATFORM_OWNER', 'ALPHA_MEMBER', 'SYSTEM', 'SERVER_SURFER']),
  enabled: z.boolean(),
});
export const ownerUserUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/u)
      .optional(),
    email: emailSchema.optional(),
    displayName: z.string().trim().min(1).max(64).optional(),
    emailVerified: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');
export const ownerProfileAssetSchema = z.object({
  asset: z.enum(['AVATAR', 'BANNER']),
  reason: z.string().trim().min(3).max(512),
});
export const ownerServerUpdateSchema = z
  .object({
    name: serverNameSchema.optional(),
    description: serverDescriptionSchema.nullable().optional(),
    discoveryEnabled: z.boolean().optional(),
    platformFeatured: z.boolean().optional(),
    platformVerified: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const ownerServerDeletionSchema = z.object({
  reason: z.string().trim().min(3).max(512),
  confirmation: z.literal('DELETE'),
});

export const ownerServerSuspensionSchema = z
  .object({
    suspended: z.boolean(),
    reason: z.string().trim().min(3).max(512).nullable(),
  })
  .superRefine((value, context) => {
    if (value.suspended && !value.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'validation.reasonRequired' });
    }
  });

export const ownerServerTransferSchema = z.object({
  newOwnerId: z.string().uuid(),
  reason: z.string().trim().min(3).max(512),
});

export const ownerPlatformSettingKeySchema = z.enum([
  'registration.enabled',
  'maintenance.enabled',
  'discovery.enabled',
  'media.uploadMaxMb',
  'media.textPreviewMaxKb',
  'moderation.defaultSpamThreshold',
  'systemMessages.moderation',
  'systemMessages.reports',
  'systemMessages.security',
  'systemMessages.badges',
]);

export const ownerPlatformSettingUpdateSchema = z.object({
  value: z.union([z.boolean(), z.number().finite()]),
  reason: z.string().trim().min(3).max(512),
});

export const ownerAnnouncementCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(1).max(4000),
    severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).default('INFO'),
    audience: z.enum(['ALL', 'ACTIVE', 'ALPHA', 'SELECTED']),
    targetUserIds: z.array(z.string().uuid()).max(1000).default([]),
    confirmation: z.literal('SEND'),
  })
  .superRefine((value, context) => {
    if (value.audience === 'SELECTED' && value.targetUserIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['targetUserIds'],
        message: 'validation.recipientsRequired',
      });
    }
    if (value.audience !== 'SELECTED' && value.targetUserIds.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['targetUserIds'],
        message: 'validation.unexpectedRecipients',
      });
    }
  });

export const ownerSystemMessageSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(4000),
  severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).default('INFO'),
});

export const ownerAuditQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  action: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const ownerReportUpdateSchema = z.object({
  status: userReportStatusSchema,
  ownerNote: z.string().trim().max(2000).nullable().optional(),
});

export const ownerStaffRoleSchema = z.object({
  role: platformStaffRoleSchema.nullable(),
  reason: z.string().trim().min(3).max(512),
});

export const ownerUserDeletionSchema = z.object({
  reason: z.string().trim().min(3).max(512),
  confirmation: z.literal('DELETE'),
});

export const ownerPasswordResetSchema = z.object({
  newPassword: passwordSchema,
  reason: z.string().trim().min(3).max(512),
});

export const ownerSessionRevokeSchema = z.object({
  reason: z.string().trim().min(3).max(240),
});

export const ownerIpBlockCreateSchema = z.object({
  ipHash: z
    .string()
    .trim()
    .length(64)
    .regex(/^[a-f0-9]+$/u),
  reason: z.string().trim().min(3).max(512),
  durationMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
});

export const ownerIpBlockSchema = z.object({
  id: z.string().uuid(),
  ipHash: z.string().length(64),
  reason: z.string(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  createdById: z.string().uuid(),
});

export const ownerMessageSearchSchema = z.object({
  q: z.string().trim().min(2).max(256),
  source: z.enum(['CHANNEL', 'DIRECT', 'GROUP', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ownerBulkMessageActionSchema = z.object({
  items: z
    .array(
      z.object({ source: z.enum(['CHANNEL', 'DIRECT', 'GROUP']), messageId: z.string().uuid() }),
    )
    .min(1)
    .max(100),
  reason: z.string().trim().min(3).max(512),
  caseId: z.string().uuid().nullable().optional(),
  confirmation: z.literal('QUARANTINE'),
});

export const ownerQuarantineRestoreSchema = z.object({
  reason: z.string().trim().min(3).max(512),
});

export const ownerAdminCaseCreateSchema = z.object({
  category: z.string().trim().min(2).max(40),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  summary: z.string().trim().min(3).max(500),
  targetUserId: z.string().uuid().nullable().optional(),
  serverId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const ownerAdminCaseUpdateSchema = z
  .object({
    status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
    resolution: z.string().trim().max(2000).nullable().optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const ownerAdminCaseNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const ownerAdminCaseReplySchema = z.object({
  body: z.string().trim().min(1).max(4000),
  sendEmail: z.boolean().default(true),
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED']).optional(),
});

export const ownerAdminCaseEvidenceSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().nonnegative().max(50_000_000).default(0),
  externalUrl: z.string().url().max(2048).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const ownerAppealsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const ownerAppealCreateSchema = z.object({
  caseId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().trim().min(10).max(4000),
});

export const ownerAppealUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED']),
  response: z.string().trim().max(4000).nullable().optional(),
});

export const submitAppealSchema = z.object({
  caseId: z.string().uuid(),
  reason: z.string().trim().min(10).max(4000),
});

export const ownerCasesQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED', 'ALL']).default('ALL'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const ownerRiskEventsQuerySchema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE', 'ALL']).default('ALL'),
  minScore: z.coerce.number().int().min(0).max(100).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const ownerRiskEventUpdateSchema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE']),
  reason: z.string().trim().max(512).optional(),
});

export const ownerBillingQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const ownerBillingRefundSchema = z.object({
  reason: z.string().trim().min(3).max(512),
  confirmation: z.literal('REFUND'),
});

export const ownerServerInspectSchema = z.object({
  serverId: z.string().uuid(),
  messageLimit: z.coerce.number().int().min(1).max(200).default(100),
});

export const userReportSchema = z.object({
  id: z.string().uuid(),
  category: userReportCategorySchema,
  title: z.string(),
  description: z.string(),
  pageUrl: z.string().nullable(),
  status: userReportStatusSchema,
  ownerNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reportedUserId: z.string().uuid().nullable(),
  reporter: z.object({
    id: z.string().uuid(),
    publicId: z.string(),
    username: z.string(),
    displayName: z.string(),
  }),
});

export const ownerUserSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  platformRole: z.enum(['USER', 'OWNER']),
  platformStaffRole: platformStaffRoleSchema.nullable().default(null),
  system: z.boolean().default(false),
  emailVerified: z.boolean(),
  badges: z.array(platformBadgeSchema),
  alphaMember: z.boolean(),
  wapvePlusActive: z.boolean(),
  wapvePlusUntil: z.string().datetime().nullable(),
  supportSlots: z.number().int().min(2).max(10).default(2),
  muted: z.boolean(),
  muteExpiresAt: z.string().datetime().nullable(),
  muteReason: z.string().nullable(),
  deletionScheduledFor: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  sessionCount: z.number().int().nonnegative(),
  serverCount: z.number().int().nonnegative().default(0),
  reportCount: z.number().int().nonnegative().default(0),
  lastSeenAt: z.string().datetime().nullable().default(null),
  avatarPresent: z.boolean().default(false),
  bannerPresent: z.boolean().default(false),
});

export const ownerDashboardSchema = z.object({
  generatedAt: z.string().datetime(),
  users: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    muted: z.number().int().nonnegative(),
    newLast24Hours: z.number().int().nonnegative(),
  }),
  servers: z.object({
    total: z.number().int().nonnegative(),
    newLast24Hours: z.number().int().nonnegative(),
  }),
  sessions: z.object({ active: z.number().int().nonnegative() }),
  reports: z.object({
    openUser: z.number().int().nonnegative(),
    openContent: z.number().int().nonnegative(),
  }),
  activity: z.object({
    channelMessages: z.number().int().nonnegative(),
    directMessages: z.number().int().nonnegative(),
    groupMessages: z.number().int().nonnegative(),
    notifications: z.number().int().nonnegative(),
  }),
  security: z.object({
    twoFactorUsers: z.number().int().nonnegative(),
    suspiciousSessions: z.number().int().nonnegative(),
  }),
});
export const ownerServerSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  discoveryEnabled: z.boolean(),
  platformFeatured: z.boolean(),
  platformVerified: z.boolean(),
  platformSuspendedAt: z.string().datetime().nullable(),
  platformSuspensionReason: z.string().nullable(),
  deletedAt: z.string().datetime().nullable(),
  deletionScheduledFor: z.string().datetime().nullable(),
  ownerId: z.string().uuid(),
  owner: z.object({ username: z.string(), displayName: z.string() }),
  memberCount: z.number().int().nonnegative(),
  channelCount: z.number().int().nonnegative(),
  emojiCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ownerBadgeCatalogEntrySchema = z.object({
  code: platformBadgeSchema,
  name: z.string(),
  description: z.string(),
  color: z.string(),
  assignable: z.boolean(),
  protected: z.boolean(),
});

export const ownerPlatformSettingSchema = z.object({
  key: ownerPlatformSettingKeySchema,
  value: z.union([z.boolean(), z.number()]),
  description: z.string(),
  updatedAt: z.string().datetime().nullable(),
  updatedBy: z.object({ username: z.string(), displayName: z.string() }).nullable(),
});

export const ownerAnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']),
  audience: z.enum(['ALL', 'ACTIVE', 'ALPHA', 'SELECTED']),
  targetUserIds: z.array(z.string().uuid()),
  status: z.enum(['DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'CANCELED']),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  creator: z.object({ username: z.string(), displayName: z.string() }),
});

export const ownerOperationsSchema = z.object({
  generatedAt: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  nodeVersion: z.string(),
  database: z.enum(['HEALTHY', 'DEGRADED']),
  redis: z.enum(['HEALTHY', 'DEGRADED']),
  memory: z.object({ usedMb: z.number().nonnegative(), rssMb: z.number().nonnegative() }),
  jobs: z.object({
    pendingScheduledMessages: z.number().int().nonnegative(),
    failedScheduledMessages: z.number().int().nonnegative(),
  }),
  realtime: z.object({
    activeSessions: z.number().int().nonnegative(),
    activeVoiceConnections: z.number().int().nonnegative(),
  }),
});

export const ownerAnalyticsSchema = z.object({
  generatedAt: z.string().datetime(),
  windowDays: z.number().int().positive(),
  totals: z.object({
    users: z.number().int().nonnegative(),
    servers: z.number().int().nonnegative(),
    messages: z.number().int().nonnegative(),
    activeSessions: z.number().int().nonnegative(),
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      newUsers: z.number().int().nonnegative(),
      newServers: z.number().int().nonnegative(),
      messages: z.number().int().nonnegative(),
      activeSessions: z.number().int().nonnegative(),
      revenueMinor: z.number().int(),
    }),
  ),
  retention: z.object({
    d1: z.number().min(0).max(100),
    d7: z.number().min(0).max(100),
    d30: z.number().min(0).max(100),
  }),
});

export const ownerMessageSearchResultSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['CHANNEL', 'DIRECT', 'GROUP']),
  content: z.string().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  author: z.object({ id: z.string().uuid(), username: z.string(), displayName: z.string() }),
  serverId: z.string().uuid().nullable(),
  channelId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
});

export const ownerAdminCaseSchema = z.object({
  id: z.string().uuid(),
  caseNumber: z.string(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'APPEALED']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  category: z.string(),
  summary: z.string(),
  resolution: z.string().nullable(),
  targetUserId: z.string().uuid().nullable(),
  serverId: z.string().uuid().nullable(),
  createdById: z.string().uuid(),
  assignedToId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  notes: z.array(
    z.object({
      id: z.string().uuid(),
      body: z.string(),
      authorId: z.string().uuid(),
      createdAt: z.string().datetime(),
    }),
  ),
  evidence: z.array(
    z.object({
      id: z.string().uuid(),
      originalName: z.string(),
      contentType: z.string(),
      size: z.number().int().nonnegative(),
      storageKey: z.string().nullable(),
      externalUrl: z.string().nullable(),
      description: z.string().nullable(),
      createdAt: z.string().datetime(),
    }),
  ),
  appeals: z.array(
    z.object({
      id: z.string().uuid(),
      caseId: z.string().uuid(),
      userId: z.string().uuid(),
      reason: z.string(),
      status: z.enum(['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED']),
      response: z.string().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      resolvedAt: z.string().datetime().nullable(),
    }),
  ),
});

export const ownerRiskEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  type: z.enum([
    'LOGIN_FAILURE',
    'NEW_DEVICE',
    'SUSPICIOUS_SESSION',
    'RATE_LIMIT',
    'ACCOUNT_TAKEOVER',
    'IP_BLOCK',
  ]),
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE']),
  score: z.number().int(),
  reason: z.string(),
  ipHash: z.string().length(64).nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
});

export const ownerBillingEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['SUBSCRIPTION', 'GIFT', 'REFUND', 'MANUAL_GRANT', 'MANUAL_REVOKE']),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  amountMinor: z.number().int(),
  currency: z.string(),
  provider: z.string().nullable(),
  externalId: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const ownerServerInspectResultSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  members: z.array(
    z.object({
      id: z.string().uuid(),
      username: z.string(),
      displayName: z.string(),
      role: z.string(),
      joinedAt: z.string().datetime(),
    }),
  ),
  channels: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.enum(['TEXT', 'VOICE']),
      position: z.number().int(),
      categoryId: z.string().uuid().nullable(),
    }),
  ),
  messages: z.array(ownerMessageSearchResultSchema),
});

export const ownerAuditEntrySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  reason: z.string().nullable(),
  actorSnapshot: z.string().nullable(),
  targetSnapshot: z.string().nullable(),
  requestId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export const ownerAuditActionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['BAN', 'UNBAN', 'MUTE', 'UNMUTE', 'REVOKE_SESSIONS']),
  reason: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  target: z.object({
    id: z.string().uuid(),
    publicId: z.string(),
    username: z.string(),
    displayName: z.string(),
  }),
});

export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;
export type OwnerUnlockInput = z.infer<typeof ownerUnlockSchema>;
export type OwnerUserSearchInput = z.infer<typeof ownerUserSearchSchema>;
export type OwnerUsersQuery = z.infer<typeof ownerUsersQuerySchema>;
export type OwnerServersQuery = z.infer<typeof ownerServersQuerySchema>;
export type OwnerSanctionInput = z.infer<typeof ownerSanctionSchema>;
export type OwnerAlphaBadgeInput = z.infer<typeof ownerAlphaBadgeSchema>;
export type OwnerBadgeAssignmentInput = z.infer<typeof ownerBadgeAssignmentSchema>;
export type OwnerUserUpdateInput = z.infer<typeof ownerUserUpdateSchema>;
export type OwnerProfileAssetInput = z.infer<typeof ownerProfileAssetSchema>;
export type OwnerServerUpdateInput = z.infer<typeof ownerServerUpdateSchema>;
export type OwnerServerDeletionInput = z.infer<typeof ownerServerDeletionSchema>;
export type OwnerServerSuspensionInput = z.infer<typeof ownerServerSuspensionSchema>;
export type OwnerServerTransferInput = z.infer<typeof ownerServerTransferSchema>;
export type OwnerPlatformSettingKey = z.infer<typeof ownerPlatformSettingKeySchema>;
export type OwnerPlatformSettingUpdateInput = z.infer<typeof ownerPlatformSettingUpdateSchema>;
export type OwnerAnnouncementCreateInput = z.infer<typeof ownerAnnouncementCreateSchema>;
export type OwnerSystemMessageInput = z.infer<typeof ownerSystemMessageSchema>;
export type OwnerAuditQuery = z.infer<typeof ownerAuditQuerySchema>;
export type OwnerReportUpdateInput = z.infer<typeof ownerReportUpdateSchema>;
export type OwnerStaffRoleInput = z.infer<typeof ownerStaffRoleSchema>;
export type OwnerUserDeletionInput = z.infer<typeof ownerUserDeletionSchema>;
export type OwnerPasswordResetInput = z.infer<typeof ownerPasswordResetSchema>;
export type OwnerSessionRevokeInput = z.infer<typeof ownerSessionRevokeSchema>;
export type OwnerIpBlockCreateInput = z.infer<typeof ownerIpBlockCreateSchema>;
export type OwnerMessageSearchInput = z.infer<typeof ownerMessageSearchSchema>;
export type OwnerBulkMessageActionInput = z.infer<typeof ownerBulkMessageActionSchema>;
export type OwnerQuarantineRestoreInput = z.infer<typeof ownerQuarantineRestoreSchema>;
export type OwnerAdminCaseCreateInput = z.infer<typeof ownerAdminCaseCreateSchema>;
export type OwnerAdminCaseUpdateInput = z.infer<typeof ownerAdminCaseUpdateSchema>;
export type OwnerAdminCaseNoteInput = z.infer<typeof ownerAdminCaseNoteSchema>;
export type OwnerAdminCaseReplyInput = z.infer<typeof ownerAdminCaseReplySchema>;
export type OwnerAdminCaseEvidenceInput = z.infer<typeof ownerAdminCaseEvidenceSchema>;
export type OwnerAppealsQuery = z.infer<typeof ownerAppealsQuerySchema>;
export type OwnerAppealCreateInput = z.infer<typeof ownerAppealCreateSchema>;
export type OwnerAppealUpdateInput = z.infer<typeof ownerAppealUpdateSchema>;
export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;
export type OwnerCasesQuery = z.infer<typeof ownerCasesQuerySchema>;
export type OwnerRiskEventsQuery = z.infer<typeof ownerRiskEventsQuerySchema>;
export type OwnerRiskEventUpdateInput = z.infer<typeof ownerRiskEventUpdateSchema>;
export type OwnerBillingQuery = z.infer<typeof ownerBillingQuerySchema>;
export type OwnerBillingRefundInput = z.infer<typeof ownerBillingRefundSchema>;
export type OwnerServerInspectInput = z.infer<typeof ownerServerInspectSchema>;
export type UserReport = z.infer<typeof userReportSchema>;
export type OwnerUser = z.infer<typeof ownerUserSchema>;
export type OwnerDashboard = z.infer<typeof ownerDashboardSchema>;
export type OwnerServer = z.infer<typeof ownerServerSchema>;
export type OwnerAuditAction = z.infer<typeof ownerAuditActionSchema>;
export type OwnerBadgeCatalogEntry = z.infer<typeof ownerBadgeCatalogEntrySchema>;
export type OwnerPlatformSetting = z.infer<typeof ownerPlatformSettingSchema>;
export type OwnerAnnouncement = z.infer<typeof ownerAnnouncementSchema>;
export type OwnerOperations = z.infer<typeof ownerOperationsSchema>;
export type OwnerAnalytics = z.infer<typeof ownerAnalyticsSchema>;
export type OwnerAuditEntry = z.infer<typeof ownerAuditEntrySchema>;
export type OwnerMessageSearchResult = z.infer<typeof ownerMessageSearchResultSchema>;
export type OwnerAdminCase = z.infer<typeof ownerAdminCaseSchema>;
export type OwnerRiskEvent = z.infer<typeof ownerRiskEventSchema>;
export type OwnerIpBlock = z.infer<typeof ownerIpBlockSchema>;
export type OwnerBillingEntry = z.infer<typeof ownerBillingEntrySchema>;
export type OwnerServerInspectResult = z.infer<typeof ownerServerInspectResultSchema>;
