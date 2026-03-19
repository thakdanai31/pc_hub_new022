import { z } from 'zod/v4';

export const addCartItemBodySchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
});

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;

export const updateCartItemBodySchema = z.object({
  quantity: z.number().int().positive().max(99),
});

export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;

export const cartItemIdParamSchema = z.object({
  cartItemId: z.coerce.number().int().positive(),
});
