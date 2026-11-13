import { z } from "zod";
import { httpError } from "../utils/http-error.js";

export const graphQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(2).default(1),
}).strict();

export function parseGraphQuery(req, _res, next) {
  const result = graphQuerySchema.safeParse(req.query);
  if (!result.success) {
    const error = httpError(400, "VALIDATION_ERROR", "Graph query validation failed");
    error.details = result.error.issues.map(({ path, message }) => ({ path: path.join("."), message }));
    return next(error);
  }
  req.validatedQuery = result.data;
  return next();
}
