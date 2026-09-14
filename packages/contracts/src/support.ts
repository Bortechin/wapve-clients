import { z } from 'zod';

export const supportCategorySchema = z.enum([
  'ACCOUNT',
  'BILLING',
  'TECHNICAL',
  'SAFETY',
  'FEEDBACK',
  'OTHER',
]);
export const supportStatusSchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
  'SPAM',
]);
export const supportPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const supportLocaleSchema = z.enum(['tr', 'en']);
export const supportReferenceSchema = z
  .string()
  .trim()
  .regex(/^WP-(?:[A-F0-9]{20}|\d{6}-[A-Z0-9]{4})$/i);
const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const createSupportTicketSchema = z.object({
  category: supportCategorySchema,
  email: emailSchema,
  requesterName: z.string().trim().max(80).optional(),
  subject: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .refine((value) => !/[\r\n]/u.test(value)),
  description: z.string().trim().min(10).max(4000),
  entityId: z.string().trim().max(100).optional(),
  locale: supportLocaleSchema.default('tr'),
  turnstileToken: z.string().max(2048).optional(),
});
export const supportStaffLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/u),
});
export const supportAgentNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[\p{L}\p{M} .'-]+$/u),
});
export const supportTicketQuerySchema = z.object({
  view: z.enum(['all', 'mine', 'unassigned', 'waiting', 'resolved']).default('all'),
  category: supportCategorySchema.optional(),
  status: supportStatusSchema.optional(),
  priority: supportPrioritySchema.optional(),
  search: z.string().trim().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const supportReplySchema = z.object({
  body: z.string().trim().min(1).max(3800),
  internal: z.boolean().default(false),
  status: z.enum(['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED']).optional(),
});
export const supportCustomerReplySchema = z.object({ body: z.string().trim().min(1).max(4000) });
export const supportUpdateSchema = z
  .object({
    status: supportStatusSchema.optional(),
    priority: supportPrioritySchema.optional(),
    category: supportCategorySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const supportAssignSchema = z.object({ agentId: z.string().uuid().nullable() });
export const supportAnalyticsQuerySchema = z.object({
  category: supportCategorySchema.optional(),
  agentId: z.string().uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type SupportAnalyticsQuery = z.infer<typeof supportAnalyticsQuerySchema>;
export const supportTokenExchangeSchema = z.object({
  reference: supportReferenceSchema,
  token: z.string().min(32).max(128),
});
export const supportAccessRequestSchema = z.object({
  reference: supportReferenceSchema,
  email: emailSchema,
  turnstileToken: z.string().max(2048).optional(),
});
export const supportRatingSchema = z.object({
  reference: supportReferenceSchema,
  token: z.string().min(32).max(128),
  overall: z.number().int().min(1).max(5),
  resolved: z.boolean(),
  speed: z.number().int().min(1).max(5),
  clarity: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  mayContact: z.boolean().default(false),
});
export const supportCannedReplySchema = z.object({
  category: supportCategorySchema.nullable(),
  locale: supportLocaleSchema,
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(3).max(3800),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export type SupportCategory = z.infer<typeof supportCategorySchema>;
export type SupportStatus = z.infer<typeof supportStatusSchema>;
export type SupportPriority = z.infer<typeof supportPrioritySchema>;
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type SupportStaffLoginInput = z.infer<typeof supportStaffLoginSchema>;
export type SupportTicketQuery = z.infer<typeof supportTicketQuerySchema>;
export type SupportReplyInput = z.infer<typeof supportReplySchema>;
export type SupportUpdateInput = z.infer<typeof supportUpdateSchema>;
export type SupportRatingInput = z.infer<typeof supportRatingSchema>;
export type SupportCannedReplyInput = z.infer<typeof supportCannedReplySchema>;
export type MobileSupportStaffSession = SupportStaffIdentity & { token: string };
export type MobileSupportCustomerSession = { success: boolean; reference: string; token: string };

export interface SupportAttachment {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  scanStatus: 'PENDING' | 'CLEAN' | 'REJECTED';
  createdAt: string;
}
export interface SupportMessage {
  id: string;
  authorType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  authorName: string;
  body: string;
  internal: boolean;
  createdAt: string;
  attachments: SupportAttachment[];
  emailStatus?: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | undefined;
}
export interface SupportTicketSummary {
  id: string;
  reference: string;
  requesterEmail: string;
  requesterName: string | null;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  locale: 'tr' | 'en';
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  resolvedAt: string | null;
  reopenUntil: string | null;
  hasCustomerUpdate: boolean;
}
export interface SupportTicketDetail extends SupportTicketSummary {
  relatedEntity: string | null;
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  events: {
    id: string;
    type: string;
    actorName: string | null;
    metadata: unknown;
    createdAt: string;
  }[];
  rating: {
    overall: number;
    resolved: boolean;
    speed: number;
    clarity: number;
    professionalism: number;
    comment: string | null;
    mayContact: boolean;
    createdAt: string;
  } | null;
}
export interface SupportStaffIdentity {
  userId: string;
  email: string;
  displayName: string | null;
  owner: boolean;
  needsOnboarding: boolean;
  expiresAt: string;
}
export interface SupportCannedReply {
  id: string;
  category: SupportCategory | null;
  locale: 'tr' | 'en';
  title: string;
  body: string;
  active: boolean;
  sortOrder: number;
}
