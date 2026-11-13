import { Router } from "express";
import { authenticate } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { parseIntelligenceQuery } from "../validators/intelligence.js";
import { exportIntelligence, findByAddress, getIntelligenceRecord, listIntelligence } from "../services/intelligence/directory-service.js";

export const intelligenceRouter = Router();
intelligenceRouter.use(requireDatabase, authenticate);

intelligenceRouter.get("/", parseIntelligenceQuery, async (req, res) => {
  const { items, meta } = await listIntelligence(req.validatedQuery);
  res.json({ success: true, data: items, meta, requestId: req.id });
});

function csvCell(value) {
  const stringValue = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  const safeValue = /^[\s]*[=+@-]/.test(stringValue) ? `'${stringValue}` : stringValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

intelligenceRouter.get("/export.csv", parseIntelligenceQuery, async (req, res) => {
  const { items, total } = await exportIntelligence(req.validatedQuery);
  const columns = [
    ["address", "Address"], ["chain", "Chain"], ["category", "Category"], ["riskLevel", "Risk level"],
    ["entityName", "Entity"], ["sourceName", "Source"], ["sourceId", "Source ID"], ["sourceUrl", "Source URL"],
    ["description", "Description"], ["confidence", "Confidence"], ["effectiveAt", "Effective at"],
    ["lastSeenAt", "Last seen at"], ["ingestedAt", "Imported at"], ["rawReference", "Source reference"],
    ["tags", "Tags"], ["confirmed", "Confirmed"],
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(",")];
  for (const item of items) lines.push(columns.map(([key]) => csvCell(key === "tags" ? item.tags?.join(" | ") : item[key])).join(","));
  const filename = `chainguard-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Export-Count": String(total),
  });
  res.send(`\uFEFF${lines.join("\r\n")}\r\n`);
});

intelligenceRouter.get("/address/:chain/:address", async (req, res) => {
  const data = await findByAddress(req.params.chain, req.params.address);
  res.json({ success: true, data, requestId: req.id });
});

intelligenceRouter.get("/:id", async (req, res) => {
  const record = await getIntelligenceRecord(req.params.id);
  res.json({ success: true, data: { record }, requestId: req.id });
});
