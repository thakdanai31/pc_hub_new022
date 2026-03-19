import { z } from 'zod/v4';

export const updateProfileBodySchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().min(9).max(15).optional(),
}).refine(
  (data) => data.firstName !== undefined || data.lastName !== undefined || data.phoneNumber !== undefined,
  { message: 'At least one field must be provided' },
);

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
