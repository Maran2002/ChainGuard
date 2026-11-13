import { z } from "zod";

const sourceIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const httpUrl = z.string().url().refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
});

export const sourceMetadataSchema = z.object({
  id: sourceIdSchema,
  name: z.string().trim().min(1).max(120),
  chains: z.array(z.enum(["TRON", "ETHEREUM", "BSC"])).min(1).optional(),
  attributionUrl: httpUrl.nullable().optional(),
  termsUrl: httpUrl.nullable().optional(),
  updateCadence: z.string().trim().max(120).nullable().optional(),
  freshnessMaxAgeHours: z.number().int().min(1).max(720).nullable().optional(),
  freshnessUsesSourceTimestamp: z.boolean().optional(),
  maxRecordsPerRun: z.number().int().min(1).max(10000).optional(),
  snapshot: z.boolean().optional(),
}).strict();

export function assertIntelligenceAdapter(adapter) {
  if (!adapter || typeof adapter.fetchRecords !== "function" || typeof adapter.normalizeRecord !== "function" || typeof adapter.getSourceMetadata !== "function") {
    throw new TypeError("Intelligence adapters must implement fetchRecords, normalizeRecord, and getSourceMetadata");
  }
  const metadata = Object.freeze(sourceMetadataSchema.parse(adapter.getSourceMetadata()));
  return { adapter: Object.freeze({ ...adapter }), metadata };
}
