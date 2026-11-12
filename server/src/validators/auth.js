import { z } from "zod";
import { httpError } from "../utils/http-error.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
}).strict();

export function parseBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = httpError(400, "VALIDATION_ERROR", "Request validation failed");
      error.details = result.error.issues.map(({ path, message }) => ({ path: path.join("."), message }));
      return next(error);
    }
    req.validatedBody = result.data;
    return next();
  };
}
