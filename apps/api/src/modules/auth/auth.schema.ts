import { z } from 'zod/v4';

export const registerBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phoneNumber: z.string().min(9).max(15),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
