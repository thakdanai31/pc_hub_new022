import { z } from 'zod/v4';
import { normalizePhoneNumber } from '../../utils/phone.js';

const updatePhoneNumberSchema = z
  .string()
  .trim()
  .transform(normalizePhoneNumber)
  .pipe(z.string().min(9).max(15));

export const updateProfileBodySchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phoneNumber: updatePhoneNumberSchema.optional(),
}).refine(
  (data) => data.firstName !== undefined || data.lastName !== undefined || data.phoneNumber !== undefined,
  { message: 'At least one field must be provided' },
);

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
