import { z } from 'zod/v4';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const dailySalesQuerySchema = z.object({
  date: z
    .string()
    .regex(dateRegex, 'Date must be in YYYY-MM-DD format')
    .refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: 'Invalid date' },
    )
    .optional(),
});

export type DailySalesQuery = z.infer<typeof dailySalesQuerySchema>;
