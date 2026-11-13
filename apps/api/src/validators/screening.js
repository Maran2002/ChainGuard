import { z } from "zod";
import { httpError } from "../utils/http-error.js";

export const createScreeningSchema = z.object({
  chain: z.enum(["TRON", "ETHEREUM", "BSC"]),
  address: z.string().trim().min(1).max(100),
  transactionHash: z.string().trim().regex(/^(0x)?[a-fA-F0-9]{64}$/).optional(),
  depth: z.coerce.number().int().min(1).max(2).default(1),
}).strict();

export const screeningListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  chain: z.enum(["TRON", "ETHEREUM", "BSC"]).optional(),
  verdict: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const reinvestigationSchema = z.object({
  depth: z.coerce.number().int().min(1).max(2).optional(),
}).strict().default({});

export function parseQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const error = httpError(400, "VALIDATION_ERROR", "Query validation failed");
      error.details = result.error.issues.map(({ path, message }) => ({ path: path.join("."), message }));
      return next(error);
    }
    req.validatedQuery = result.data;
    return next();
  };
}
