import { z } from "zod";

/**
 * Generic API error envelope shared by every `/api/v1` endpoint. The set of
 * concrete `code` values is intentionally left open (not an enum) because
 * PR-01 does not implement any business endpoint yet; a fixed error-code
 * registry is introduced alongside the first real endpoints.
 */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
    correlationId: z.string().min(1).optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
