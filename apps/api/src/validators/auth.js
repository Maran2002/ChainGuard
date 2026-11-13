import { z } from "zod";
import { httpError } from "../utils/http-error.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254).refine((value) => {
    if (value.includes("@")) return z.string().email().max(254).safeParse(value).success;
    return /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}$/.test(value);
  }, "Enter a valid email or username"),
  password: z.string().min(1).max(72),
}).strict();

export const emailOnlySchema = z.object({ email: z.string().trim().email().max(254) }).strict();
export const actionTokenSchema = z.object({ token: z.string().min(32).max(200) }).strict();
export const passwordResetSchema = z.object({
  token: z.string().min(32).max(200),
  newPassword: z.string().min(12).max(72),
  confirmPassword: z.string().min(12).max(72),
}).strict().refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Password and confirmation must match",
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
}).strict();

export const preferencesUpdateSchema = z.object({
  defaultChain: z.enum(["TRON", "ETHEREUM", "BSC"]),
  defaultInvestigationDepth: z.coerce.number().int().min(1).max(2),
}).strict();

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(12).max(72),
  confirmPassword: z.string().min(12).max(72),
}).strict().refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "New password and confirmation must match",
});

export const accountDeletionSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  confirmation: z.literal("DELETE"),
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
