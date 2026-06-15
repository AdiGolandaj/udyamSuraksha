import { z } from "zod";

export const querySchema = z.object({
  queryType:   z.string().min(1),
  description: z.string().min(10).max(2000),
  priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type QueryInput = z.infer<typeof querySchema>;
