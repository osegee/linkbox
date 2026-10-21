import { z } from "zod";

export const createTagSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Tag name is required")
    .max(30, "Tag name cannot exceed 30 characters")
    .regex(
      /^[a-z0-9-_ ]+$/,
      "Tag can only contain letters, numbers, spaces, hyphens, and underscores",
    ),
});

export const updateTagSchema = createTagSchema;

export const attachTagsSchema = z.object({
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .min(1, "Provide at least one tag")
    .max(10, "Cannot attach more than 10 tags at once"),
});

export type createTagInput = z.infer<typeof createTagSchema>;
export type updateTagInput = z.infer<typeof updateTagSchema>;
export type attachTagsInput = z.infer<typeof attachTagsSchema>;
