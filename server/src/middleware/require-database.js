import mongoose from "mongoose";
import { httpError } from "../utils/http-error.js";

export function requireDatabase(_req, _res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(httpError(503, "DATABASE_UNAVAILABLE", "Account services are temporarily unavailable"));
  }
  return next();
}
