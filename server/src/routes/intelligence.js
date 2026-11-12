import { Router } from "express";
import { authenticate } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { parseIntelligenceQuery } from "../validators/intelligence.js";
import { findByAddress, getIntelligenceRecord, listIntelligence } from "../services/intelligence/directory-service.js";

export const intelligenceRouter = Router();
intelligenceRouter.use(requireDatabase, authenticate);

intelligenceRouter.get("/", parseIntelligenceQuery, async (req, res) => {
  const { items, meta } = await listIntelligence(req.validatedQuery);
  res.json({ success: true, data: items, meta, requestId: req.id });
});

intelligenceRouter.get("/address/:chain/:address", async (req, res) => {
  const data = await findByAddress(req.params.chain, req.params.address);
  res.json({ success: true, data, requestId: req.id });
});

intelligenceRouter.get("/:id", async (req, res) => {
  const record = await getIntelligenceRecord(req.params.id);
  res.json({ success: true, data: { record }, requestId: req.id });
});
