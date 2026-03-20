import { z } from 'zod/v4';
import { normalizePhoneNumber } from '../../../utils/phone.js';

const privilegedUserPhoneNumberSchema = z
  .string()
  .trim()
  .transform(normalizePhoneNumber)
  .pipe(z.string().min(9).max(20));

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).trim().optional(),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const createPrivilegedUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  phoneNumber: privilegedUserPhoneNumberSchema,
  password: z.string().min(8).max(100),
});

export type CreatePrivilegedUserBody = z.infer<typeof createPrivilegedUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phoneNumber: privilegedUserPhoneNumberSchema.optional(),
});

export type UpdateUserBody = z.infer<typeof updateUserSchema>;

const banDateTimeSchema = z.string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid bannedUntil datetime')
  .transform((value) => new Date(value));

export const disableUserSchema = z.object({
  bannedUntil: banDateTimeSchema.optional(),
  banReason: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export interface DisableUserBody {
  bannedUntil?: Date;
  banReason?: string;
}

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});
