import { z } from "zod";
import { sanitiseRecord } from "@/lib/security/input-sanitizer";

export const profileSchema = z.object({
    displayName: z
        .string()
        .min(1, "Display name is required")
        .max(80, "Display name must be 80 characters or fewer")
        .trim(),

    bio: z
        .string()
        .max(500, "Bio must be 500 characters or fewer")
        .trim()
        .optional()
        .default(""),

    website: z
        .string()
        .url("Website must be a valid URL")
        .max(200, "Website URL must be 200 characters or fewer")
        .optional()
        .or(z.literal(""))
        .default(""),

    timezone: z
        .string()
        .max(60, "Timezone must be 60 characters or fewer")
        .optional()
        .default("UTC"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export function validateProfile(raw: unknown):
    | { success: true; data: ProfileInput }
    | { success: false; errors: Record<string, string> } {
    const result = profileSchema.safeParse(raw);
    if (result.success) {
        const sanitized = sanitiseRecord(result.data);
        return { success: true, data: sanitized };
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "_";
        if (!errors[key]) errors[key] = issue.message;
    }
    return { success: false, errors };
}