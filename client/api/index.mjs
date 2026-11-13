import mongoose from "mongoose";
import * as appModule from "../../server/src/app.js";
import * as databaseModule from "../../server/src/config/database.js";

const app = appModule.app ?? appModule.default?.app ?? appModule.default;
const connectDatabase = databaseModule.connectDatabase
  ?? databaseModule.default?.connectDatabase
  ?? databaseModule.default;

if (typeof app !== "function" || typeof connectDatabase !== "function") {
  throw new TypeError("The Vercel API entry could not load the Express app and database connector");
}

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
