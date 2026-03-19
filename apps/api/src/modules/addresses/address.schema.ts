import { z } from 'zod/v4';

export const createAddressBodySchema = z.object({
  label: z.string().min(1).max(50),
  recipientName: z.string().min(1).max(100),
  phoneNumber: z.string().min(9).max(15),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  district: z.string().min(1).max(100),
  subdistrict: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postalCode: z.string().min(4).max(10),
  country: z.string().min(1).max(100).default('Thailand'),
  isDefault: z.boolean().default(false),
});

export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;

export const updateAddressBodySchema = z.object({
  label: z.string().min(1).max(50).optional(),
  recipientName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().min(9).max(15).optional(),
  line1: z.string().min(1).max(255).optional(),
  line2: z.string().max(255).nullable().optional(),
  district: z.string().min(1).max(100).optional(),
  subdistrict: z.string().min(1).max(100).optional(),
  province: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(4).max(10).optional(),
  country: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateAddressBody = z.infer<typeof updateAddressBodySchema>;

export const addressIdParamSchema = z.object({
  addressId: z.coerce.number().int().positive(),
});
