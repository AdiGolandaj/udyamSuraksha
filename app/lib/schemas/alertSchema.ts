import { z } from "zod";

export const alertSchema = z.object({
  title:       z.string().min(1).max(300),
  severity:    z.enum(["low", "medium", "high", "critical"]),
  category:    z.string().min(1),
  description: z.string().min(1),
});

export type AlertInput = z.infer<typeof alertSchema>;
