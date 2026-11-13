import { Router } from "express";
import { authenticate } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { createScreeningSchema, parseQuery, reinvestigationSchema, screeningListSchema } from "../validators/screening.js";
import { parseBody } from "../validators/auth.js";
import { createScreening, deleteScreening, getScreening, listScreenings, reinvestigateScreening } from "../services/screening/screening-service.js";
import { parseGraphQuery } from "../validators/investigation.js";
import { getScreeningGraph } from "../services/investigation/graph-service.js";

export const screeningRouter = Router();
screeningRouter.use(requireDatabase, authenticate);

screeningRouter.post("/", parseBody(createScreeningSchema), async (req, res) => {
  const result = await createScreening(req.user.id, req.validatedBody);
  res.status(201).json({ success: true, data: result, requestId: req.id });
});

screeningRouter.get("/", parseQuery(screeningListSchema), async (req, res) => {
  const result = await listScreenings(req.user.id, req.validatedQuery);
  res.json({ success: true, data: result.items, meta: result.meta, requestId: req.id });
});

screeningRouter.get("/:screeningId/graph", parseGraphQuery, async (req, res) => {
  const graph = await getScreeningGraph(req.user.id, req.params.screeningId, req.validatedQuery.depth);
  res.json({ success: true, data: graph, requestId: req.id });
});

screeningRouter.get("/:screeningId", async (req, res) => {
  const screening = await getScreening(req.user.id, req.params.screeningId);
  res.json({ success: true, data: { screening }, requestId: req.id });
});

screeningRouter.delete("/:screeningId", async (req, res) => {
  await deleteScreening(req.user.id, req.params.screeningId);
  res.json({ success: true, data: { deleted: true }, requestId: req.id });
});

screeningRouter.post("/:screeningId/reinvestigate", parseBody(reinvestigationSchema), async (req, res) => {
  const result = await reinvestigateScreening(req.user.id, req.params.screeningId, req.validatedBody.depth);
  res.status(201).json({ success: true, data: result, requestId: req.id });
});
