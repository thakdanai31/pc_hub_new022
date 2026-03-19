import { z } from 'zod/v4';

export const cartCheckoutBodySchema = z.object({
  addressId: z.number().int().positive(),
  paymentMethod: z.enum(['COD', 'PROMPTPAY_QR']),
  customerNote: z.string().max(500).optional(),
});

export type CartCheckoutBody = z.infer<typeof cartCheckoutBodySchema>;

export const buyNowCheckoutBodySchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
  addressId: z.number().int().positive(),
  paymentMethod: z.enum(['COD', 'PROMPTPAY_QR']),
  customerNote: z.string().max(500).optional(),
});

export type BuyNowCheckoutBody = z.infer<typeof buyNowCheckoutBodySchema>;

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().min(1),
});
