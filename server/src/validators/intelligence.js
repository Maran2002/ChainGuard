import { z } from "zod";
import { httpError } from "../utils/http-error.js";

export const intelligenceListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  chain: z.enum(["TRON", "ETHEREUM", "BSC"]).optional(),
  category: z.enum(["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  source: z.string().trim().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "confidence"]).default("newest"),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    context.addIssue({ code: "custom", path: ["from"], message: "Start date must be on or before end date" });
  }
});

export function parseIntelligenceQuery(req, _res, next) {
  const result = intelligenceListSchema.safeParse(req.query);
  if (!result.success) {
    const error = httpError(400, "VALIDATION_ERROR", "Query validation failed");
    error.details = result.error.issues.map(({ path, message }) => ({ path: path.join("."), message }));
    return next(error);
  }
  req.validatedQuery = result.data;
  return next();
}
