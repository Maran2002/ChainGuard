import { z } from "zod";
import { httpError } from "../utils/http-error.js";

const intelligenceListFields = {
  q: z.string().trim().max(100).optional(),
  chain: z.enum(["TRON", "ETHEREUM", "BSC"]).optional(),
  category: z.enum(["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  source: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "confidence"]).default("newest"),
};

export const intelligenceListSchema = z.object(intelligenceListFields).strict();
export const adminIntelligenceListSchema = z.object({
  ...intelligenceListFields,
  includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").default("false"),
}).strict();

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
