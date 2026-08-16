import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  authorName: z.string().min(1).max(100),
  title: z.string().max(150).optional(),
  body: z.string().min(1).max(3000),
});
