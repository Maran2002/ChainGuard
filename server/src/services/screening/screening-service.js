import { performance } from "node:perf_hooks";
import mongoose from "mongoose";
import { chains, normalizeAddress } from "../../config/chains.js";
import { getBlockchainAdapter } from "../../adapters/blockchain/registry.js";
import { IntelligenceRecord } from "../../models/intelligence-record.js";
import { Screening } from "../../models/screening.js";
import { calculateRisk } from "../risk/risk-engine.js";
import { httpError } from "../../utils/http-error.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createScreening(userId, request) {
  const startedAt = performance.now();
  if (!chains[request.chain]) throw httpError(400, "INVALID_CHAIN", "Choose a supported blockchain");
  const normalized = normalizeAddress(request.chain, request.address);
  const transactionHash = request.transactionHash?.trim() || null;
  if (transactionHash && !/^(0x)?[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw httpError(400, "INVALID_TRANSACTION_HASH", "Enter a valid 64-character transaction hash");
  }

  const adapter = getBlockchainAdapter(normalized.chain);
  if (!adapter) throw httpError(400, "INVALID_CHAIN", "Choose a supported blockchain");

  const [records, transferResult] = await Promise.all([
    IntelligenceRecord.find({ chain: normalized.chain, address: normalized.address, isActive: true }).limit(50).lean(),
    adapter.getAddressTransactions({ address: normalized.address, depth: request.depth }),
  ]);

  const directMatches = records.map((record) => ({ ...record, source: record.sourceName }));
  const providerErrors = adapter.status === "UNAVAILABLE" ? ["Blockchain transaction provider is not configured"] : [];
  const coverage = {
    complete: false,
    fresh: false,
    sources: [...new Set(records.map((record) => record.sourceName))],
    notes: ["Intelligence source freshness is not configured", transferResult.dataLabel === "SIMULATED_FIXTURE" ? "Blockchain data is simulated fixture output" : "Blockchain history provider is unavailable"],
  };
  const risk = calculateRisk({
    chain: normalized.chain,
    address: normalized.address,
    directMatches,
    exposureFindings: [],
    behaviorFindings: [],
    coverage,
    providerErrors,
    providerStatus: adapter.status,
  });

  const screening = await Screening.create({
    userId: new mongoose.Types.ObjectId(userId),
    chain: normalized.chain,
    address: normalized.address,
    transactionHash,
    verdict: risk.verdict,
    riskScore: risk.riskScore,
    riskFactors: risk.riskFactors,
    matchedRecords: risk.matchedRecords,
    exposureSummary: risk.exposureSummary,
    behaviorSummary: risk.behaviorSummary,
    coverage: risk.coverage,
    providerStatus: risk.providerStatus,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    riskModelVersion: risk.riskModelVersion,
    recommendedAction: risk.recommendedAction,
  });

  return { screening: screening.toObject(), risk, transactionData: { status: adapter.status, label: transferResult.dataLabel || null, transactions: transferResult.data || [] } };
}

export async function listScreenings(userId, query) {
  const filter = { userId };
  if (query.chain) filter.chain = query.chain;
  if (query.verdict) filter.verdict = query.verdict;
  if (query.q) filter.address = { $regex: escapeRegex(query.q), $options: "i" };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Screening.find(filter).sort({ screenedAt: -1, _id: -1 }).skip(skip).limit(query.limit).lean(),
    Screening.countDocuments(filter),
  ]);
  return { items, meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
}

export async function getScreening(userId, screeningId) {
  if (!mongoose.isValidObjectId(screeningId)) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  const screening = await Screening.findOne({ _id: screeningId, userId }).lean();
  if (!screening) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  return screening;
}

export async function deleteScreening(userId, screeningId) {
  if (!mongoose.isValidObjectId(screeningId)) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  const result = await Screening.deleteOne({ _id: screeningId, userId });
  if (result.deletedCount !== 1) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
}

export async function reinvestigateScreening(userId, screeningId) {
  const previous = await getScreening(userId, screeningId);
  return createScreening(userId, { chain: previous.chain, address: previous.address, transactionHash: previous.transactionHash || undefined, depth: 1 });
}
