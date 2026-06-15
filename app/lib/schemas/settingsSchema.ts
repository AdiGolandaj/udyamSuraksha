import { z } from "zod";

export const settingsSchema = z.object({
  language:                  z.enum(["en", "mr", "hi"]),
  emailNotificationsEnabled: z.coerce.boolean().default(true),
  phone:                     z.string().max(15).optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
