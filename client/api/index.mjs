import mongoose from "mongoose";
import { app } from "../../server/src/app.js";
import { connectDatabase } from "../../server/src/config/database.js";

const internalRouteQuery = "__cg_route";
const healthPaths = new Set(["/health", "/health/ready"]);
let databaseConnectionPromise = null;

async function ensureDatabaseConnection() {
  if (mongoose.connection.readyState === 1) return true;

  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDatabase().finally(() => {
      databaseConnectionPromise = null;
    });
  }

  return databaseConnectionPromise;
}

function restoreExpressPath(req) {
  const incomingUrl = new URL(req.url || "/", "http://vercel.local");
  const expressPath = incomingUrl.searchParams.get(internalRouteQuery);
  if (!expressPath) return incomingUrl.pathname;

  incomingUrl.searchParams.delete(internalRouteQuery);
  const query = incomingUrl.searchParams.toString();
  req.url = `${expressPath}${query ? `?${query}` : ""}`;
  return expressPath.split("?", 1)[0];
}

export default async function handler(req, res) {
  const requestPath = restoreExpressPath(req);

  if (!healthPaths.has(requestPath) && !(await ensureDatabaseConnection())) {
    return res.status(503).json({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "The database is temporarily unavailable" },
    });
  }

  return app(req, res);
}
