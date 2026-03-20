import { z } from 'zod/v4';
import { normalizePhoneNumber } from '../../utils/phone.js';

const registerPhoneNumberSchema = z
  .string()
  .trim()
  .transform(normalizePhoneNumber)
  .pipe(z.string().min(9).max(15));

export const registerBodySchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phoneNumber: registerPhoneNumberSchema,
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
});

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
