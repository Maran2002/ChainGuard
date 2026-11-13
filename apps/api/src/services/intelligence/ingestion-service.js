import mongoose from "mongoose";
import { normalizeAddress } from "../../config/chains.js";
import { IntelligenceRecord } from "../../models/intelligence-record.js";
import { IngestionJob } from "../../models/ingestion-job.js";
import { getIntelligenceAdapter, listIntelligenceSources } from "../../adapters/intelligence/registry.js";
import { httpError } from "../../utils/http-error.js";
import { env } from "../../config/env.js";

const allowedCategories = new Set(["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"]);
const allowedRiskLevels = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const maxRecordsPerRun = 500;
const fetchTimeoutMs = env.INTELLIGENCE_SOURCE_TIMEOUT_MS;
const activeSources = new Set();

function safeDate(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : "INGESTION_FAILED";
}

function normalizeRecord(raw, source, adapter) {
  const input = adapter.normalizeRecord(raw, source.metadata);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_RECORD");
  const address = normalizeAddress(input.chain, input.address);
  if (!allowedCategories.has(input.category) || !allowedRiskLevels.has(input.riskLevel)) throw new Error("INVALID_CLASSIFICATION");
  const sourceUrl = input.sourceUrl == null || input.sourceUrl === "" ? null : new URL(input.sourceUrl);
  if (sourceUrl && !["http:", "https:"].includes(sourceUrl.protocol)) throw new Error("INVALID_SOURCE_URL");
  if (sourceUrl && sourceUrl.toString().length > 1000) throw new Error("INVALID_SOURCE_URL");
  const confidence = input.confidence ?? 0.5;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) throw new Error("INVALID_CONFIDENCE");
  const tags = Array.isArray(input.tags) ? input.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim().slice(0, 60)).filter(Boolean).slice(0, 30) : [];
  return {
    address: address.address,
    chain: address.chain,
    category: input.category,
    riskLevel: input.riskLevel,
    entityName: typeof input.entityName === "string" ? input.entityName.trim().slice(0, 200) || null : null,
    sourceId: source.metadata.id,
    sourceName: source.metadata.name,
    sourceUrl: sourceUrl?.toString() || null,
    description: typeof input.description === "string" ? input.description.trim().slice(0, 2000) : "",
    confidence,
    effectiveAt: safeDate(input.effectiveAt),
    lastSeenAt: safeDate(input.lastSeenAt),
    rawReference: typeof input.rawReference === "string" ? input.rawReference.trim().slice(0, 300) || null : null,
    tags,
    confirmed: input.confirmed === true,
    isActive: true,
  };
}

async function fetchWithTimeout(adapter, metadata) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      const timeout = new Promise((_, reject) => controller.signal.addEventListener("abort", () => {
        const error = new Error("Source request timed out");
        error.name = "AbortError";
        reject(error);
      }, { once: true }));
      return await Promise.race([adapter.fetchRecords({ signal: controller.signal, source: metadata }), timeout]);
    } catch (error) {
      lastError = error;
      if (controller.signal.aborted) break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError?.name === "AbortError") throw httpError(504, "SOURCE_TIMEOUT", "The configured intelligence source timed out");
  throw httpError(502, "SOURCE_FETCH_FAILED", "The configured intelligence source could not be fetched");
}

export async function prepareSourceRecords(adapter, metadata, rawRecords) {
  if (!Array.isArray(rawRecords)) throw httpError(502, "SOURCE_INVALID_RESPONSE", "The source returned an unsupported response");
  if (rawRecords.length > (metadata.maxRecordsPerRun || maxRecordsPerRun)) throw httpError(413, "SOURCE_RECORD_LIMIT", "The source returned more records than this run allows");
  const unique = new Map();
  let skipped = 0;
  let failed = 0;
  for (const raw of rawRecords) {
    try {
      const normalized = normalizeRecord(raw, { metadata }, adapter);
      const key = [normalized.chain, normalized.address, normalized.category, normalized.sourceId].join(":");
      if (unique.has(key)) {
        skipped += 1;
        continue;
      }
      unique.set(key, normalized);
    } catch {
      failed += 1;
    }
  }
  return { records: [...unique.values()], fetched: rawRecords.length, skipped, failed };
}

async function findStaleSnapshotRecords(sourceId, records) {
  const current = await IntelligenceRecord.find({ sourceId, isActive: true }).select("_id chain address category").lean();
  const included = new Set(records.map((record) => `${record.chain}:${record.address}:${record.category}`));
  return current.filter((record) => !included.has(`${record.chain}:${record.address}:${record.category}`)).map((record) => record._id);
}

async function persistRecords(records, staleIds = [], sourceId = null) {
  const operations = records.map((record) => ({
    updateOne: {
      filter: { chain: record.chain, address: record.address, category: record.category, sourceId: record.sourceId },
      update: { $set: { ...record, ingestedAt: new Date() } },
      upsert: true,
    },
  }));
  const result = operations.length ? await IntelligenceRecord.bulkWrite(operations, { ordered: false }) : { upsertedCount: 0, modifiedCount: 0 };
  const deactivated = staleIds.length
    ? (await IntelligenceRecord.updateMany({ _id: { $in: staleIds }, sourceId, isActive: true }, { $set: { isActive: false, ingestedAt: new Date() } })).modifiedCount
    : 0;
  return { created: result.upsertedCount || 0, updated: result.modifiedCount || 0, deactivated };
}

export async function runIngestion(sourceId, { dryRun = false, startedBy = null } = {}) {
  if (!env.INTELLIGENCE_INGESTION_ENABLED) throw httpError(503, "INGESTION_DISABLED", "Intelligence ingestion is disabled by server configuration");
  const source = getIntelligenceAdapter(sourceId);
  if (!source) throw httpError(404, "SOURCE_NOT_FOUND", "No registered intelligence source matches this ID");
  if (activeSources.has(sourceId)) throw httpError(409, "INGESTION_ALREADY_RUNNING", "An ingestion run for this source is already in progress");
  activeSources.add(sourceId);
  const startedAt = Date.now();
  let job;
  let sourceGeneratedAt = null;
  try {
    job = mongoose.connection.readyState === 1
      ? await IngestionJob.create({ sourceId, sourceName: source.metadata.name, dryRun, startedBy, status: "RUNNING" })
      : null;
    const fetchResult = await fetchWithTimeout(source.adapter, source.metadata);
    const rawRecords = Array.isArray(fetchResult) ? fetchResult : fetchResult?.records;
    if (!Array.isArray(rawRecords)) throw httpError(502, "SOURCE_INVALID_RESPONSE", "The source returned an unsupported response");
    if (!Array.isArray(fetchResult)) sourceGeneratedAt = safeDate(fetchResult.sourceGeneratedAt);
    const prepared = await prepareSourceRecords(source.adapter, source.metadata, rawRecords);
    const snapshot = source.metadata.snapshot === true;
    if (snapshot && !dryRun && prepared.failed > 0) throw httpError(422, "SOURCE_SNAPSHOT_INVALID", "The complete source snapshot contains invalid records; no changes were applied");
    if (snapshot && !dryRun && prepared.records.length === 0) throw httpError(422, "SOURCE_SNAPSHOT_EMPTY", "An empty source snapshot cannot replace active records");
    const staleIds = snapshot && mongoose.connection.readyState === 1
      ? await findStaleSnapshotRecords(source.metadata.id, prepared.records)
      : [];
    const changes = dryRun ? { created: 0, updated: 0, deactivated: 0 } : await persistRecords(prepared.records, snapshot ? staleIds : [], source.metadata.id);
    const counts = {
      fetched: prepared.fetched,
      created: changes.created,
      updated: changes.updated,
      deactivated: changes.deactivated,
      skipped: prepared.skipped,
      failed: prepared.failed,
    };
    const status = dryRun ? "DRY_RUN" : prepared.failed > 0 ? "PARTIAL" : "SUCCEEDED";
    if (job) await IngestionJob.updateOne({ _id: job._id }, { $set: {
      status,
      counts: { fetched: counts.fetched, created: counts.created, updated: counts.updated, deactivated: counts.deactivated, skipped: counts.skipped, failed: counts.failed },
      sourceGeneratedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt,
    } });
    return { jobId: job?.id || null, source: source.metadata, status, dryRun, counts, sourceGeneratedAt, wouldDeactivate: dryRun ? staleIds.length : 0, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (job) await IngestionJob.updateOne({ _id: job._id }, { $set: {
      status: "FAILED",
      safeErrorCode: safeErrorCode(error),
      sourceGeneratedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt,
    } });
    throw error;
  } finally {
    activeSources.delete(sourceId);
  }
}

export async function listIngestionJobs(limit = 50) {
  return IngestionJob.find().sort({ startedAt: -1 }).limit(limit).select("sourceId sourceName status dryRun startedAt completedAt sourceGeneratedAt durationMs counts safeErrorCode").lean();
}

export function getRegisteredIntelligenceSources() {
  return listIntelligenceSources();
}
