import { z } from "zod";

export const createLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, "URL is too long")
    .pipe(z.url({ error: "Please provide a valid URL" }))
    .refine((val) => /^https?:\/\//i.test(val), {
      message: "URL must start with http:// or https://",
    }),
  collectionId: z.string().uuid("Invalid collection ID").optional(),
  note: z.string().trim().max(1000).optional(),
});

export const updateLinkSchema = z.object({
  title: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  collectionId: z.string().uuid("Invalid collection ID").nullable().optional(),
  isFavourite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export type createLinkInput = z.infer<typeof createLinkSchema>;
export type updateLinkInput = z.infer<typeof updateLinkSchema>;
