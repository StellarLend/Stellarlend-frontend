import { z } from "zod";

export const localeSchema = z.enum([
  "en-US", "es", "fr", "ja", "zh-CN", "ko", "pt-BR", "de", "it", "ru", "ar",
]);

export const displayCurrencySchema = z.enum([
  "USD", "EUR", "JPY", "GBP", "XLM", "BTC", "ETH", "CNY", "KRW", "BRL",
]);

export const notificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  sms: z.boolean().default(false),
  inApp: z.boolean().default(true),
});

export const preferencesSchema = z.object({
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  locale: localeSchema.default("en-US"),
  displayCurrency: displayCurrencySchema.default("USD"),
  notifications: z.preprocess(
    (val) => (val === undefined ? {} : val),
    notificationPreferencesSchema
  ),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export function validatePreferences(raw: unknown):
  | { success: true; data: PreferencesInput }
  | { success: false; errors: Record<string, string> } {
  const result = preferencesSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
