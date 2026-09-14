import { z } from 'zod';
import { userReportStatusSchema } from './platform.js';

export const contentReportTargetTypeSchema = z.enum([
  'CHANNEL_MESSAGE',
  'DIRECT_MESSAGE',
  'GROUP_MESSAGE',
  'USER',
  'SERVER',
]);

export const contentReportReasonSchema = z.enum([
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'SCAM_FRAUD',
  'ILLEGAL_CONTENT',
  'SELF_HARM',
  'IMPERSONATION',
  'OTHER',
]);

export const createContentReportSchema = z.object({
  targetType: contentReportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: contentReportReasonSchema,
  description: z.string().trim().max(2000).optional(),
});

export const createContentReportResponseSchema = z.object({
  id: z.string().uuid(),
  alreadyReported: z.boolean(),
});

export const ownerContentReportUpdateSchema = z.object({
  status: userReportStatusSchema,
  ownerNote: z.string().trim().max(2000).nullable().optional(),
});

export const contentReportStatusQuerySchema = z.object({
  status: userReportStatusSchema.optional(),
});

export const contentReportUserSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string(),
  username: z.string(),
  displayName: z.string(),
});

export const contentReportTargetSchema = z.object({
  messageContent: z.string().nullable(),
  messageAuthor: z
    .object({
      id: z.string().uuid(),
      username: z.string(),
      displayName: z.string(),
    })
    .nullable(),
  contextLabel: z.string().nullable(),
  user: contentReportUserSchema.nullable(),
  server: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      ownerId: z.string().uuid(),
    })
    .nullable(),
});

export const contentReportSchema = z.object({
  id: z.string().uuid(),
  targetType: contentReportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: contentReportReasonSchema,
  description: z.string().nullable(),
  status: userReportStatusSchema,
  ownerNote: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reporterCount: z.number().int().positive(),
  targetRemoved: z.boolean(),
  reporter: contentReportUserSchema,
  target: contentReportTargetSchema,
});

export type ContentReportTargetType = z.infer<typeof contentReportTargetTypeSchema>;
export type ContentReportReason = z.infer<typeof contentReportReasonSchema>;
export type CreateContentReportInput = z.infer<typeof createContentReportSchema>;
export type CreateContentReportResponse = z.infer<typeof createContentReportResponseSchema>;
export type OwnerContentReportUpdateInput = z.infer<typeof ownerContentReportUpdateSchema>;
export type ContentReportStatusQuery = z.infer<typeof contentReportStatusQuerySchema>;
export type ContentReport = z.infer<typeof contentReportSchema>;
