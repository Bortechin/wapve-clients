import { z } from 'zod';

export const serverEmojiNameSchema = z
  .string()
  .trim()
  .min(2, 'validation.serverEmojiNameTooShort')
  .max(32, 'validation.serverEmojiNameTooLong')
  .regex(/^[A-Za-z0-9_]+$/u, 'validation.serverEmojiNameFormat')
  .transform((value) => value.toLowerCase());

export const uploadServerEmojiQuerySchema = z.object({ name: serverEmojiNameSchema });
export const updateServerEmojiSchema = z.object({ name: serverEmojiNameSchema });

export const serverEmojiSchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  animated: z.boolean(),
  createdBy: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
  }),
  createdAt: z.string().datetime(),
});

export type UploadServerEmojiQuery = z.infer<typeof uploadServerEmojiQuerySchema>;
export type UpdateServerEmojiInput = z.infer<typeof updateServerEmojiSchema>;
export type ServerEmoji = z.infer<typeof serverEmojiSchema>;
