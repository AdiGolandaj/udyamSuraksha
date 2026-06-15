import { z } from "zod";

export const stockItemSchema = z.object({
  name:        z.string().min(1).max(200),
  quantity:    z.coerce.number().int().min(0),
  unit:        z.string().min(1),
  sensitivity: z.array(
    z.enum(["water", "heat", "fragile", "perishable", "flammable", "theft", "humidity"])
  ),
});

export type StockItemInput = z.infer<typeof stockItemSchema>;
