import { z } from "zod";

export const UploadStatusSchema = z.enum([
  "pending",
  "processing",
  "success",
  "failed",
  "duplicate",
]);
export type UploadStatus = z.infer<typeof UploadStatusSchema>;

export const UploadResponseSchema = z.object({
  id: z.string().uuid(),
  status: UploadStatusSchema,
  createdAt: z.string().datetime(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
