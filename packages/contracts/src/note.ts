import { z } from 'zod';

export const userNoteSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  targetId: z.string().uuid(),
  content: z.string().max(256),
});

export const updateNoteSchema = z.object({
  content: z.string().max(256),
});

export type UserNote = z.infer<typeof userNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
