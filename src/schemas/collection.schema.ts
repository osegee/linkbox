import { z } from "zod";

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").trim(),
  description: z.string().trim().optional(),
});
export type createCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = createCollectionSchema.partial();
export type updateCollectionInput = z.infer<typeof updateCollectionSchema>;
