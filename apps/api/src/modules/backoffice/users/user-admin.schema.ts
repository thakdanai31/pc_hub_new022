import { z } from 'zod/v4';

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).trim().optional(),
  role: z.enum(['STAFF', 'ADMIN']).optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const createPrivilegedUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  phoneNumber: z.string().min(9).max(20).trim(),
  password: z.string().min(8).max(100),
});

export type CreatePrivilegedUserBody = z.infer<typeof createPrivilegedUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phoneNumber: z.string().min(9).max(20).trim().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserBody = z.infer<typeof updateUserSchema>;

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});
