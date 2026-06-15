import { z } from "zod";

export const bcpSchema = z.object({
  shopId: z.string().uuid(),
  notes:  z.string().max(2000).optional(),
});

export type BCPInput = z.infer<typeof bcpSchema>;
