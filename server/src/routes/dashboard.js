import { Router } from "express";
import { authenticate } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { getDashboardSummary } from "../services/dashboard/dashboard-service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireDatabase, authenticate);

dashboardRouter.get("/summary", async (req, res) => {
  const summary = await getDashboardSummary(req.user.id);
  res.json({ success: true, data: summary, requestId: req.id });
});
