import { performance } from "node:perf_hooks";
import mongoose from "mongoose";
import { chains, normalizeAddress } from "../../config/chains.js";
import { getBlockchainAdapter } from "../../adapters/blockchain/registry.js";
import { IntelligenceRecord } from "../../models/intelligence-record.js";
import { IngestionJob } from "../../models/ingestion-job.js";
import { Screening } from "../../models/screening.js";
import { listIntelligenceSources } from "../../adapters/intelligence/registry.js";
import { normalizeAdapterTransactions } from "../investigation/transaction-normalizer.js";
import { collectCounterpartyExposure } from "../investigation/exposure-service.js";
import { calculateRisk } from "../risk/risk-engine.js";
import { httpError } from "../../utils/http-error.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getIntelligenceCoverage(chain) {
  const registered = listIntelligenceSources().filter((source) => source.chains?.includes(chain));
  if (!registered.length) {
    return { fresh: false, sources: [], sourceFreshness: [], notes: ["No intelligence sources are registered"] };
  }
  const sourceIds = registered.map((source) => source.id);
  const applies = await IngestionJob.aggregate([
    { $match: { sourceId: { $in: sourceIds }, status: "SUCCEEDED", dryRun: false, completedAt: { $ne: null } } },
    { $sort: { completedAt: -1 } },
    { $group: { _id: "$sourceId", completedAt: { $first: "$completedAt" }, sourceGeneratedAt: { $first: "$sourceGeneratedAt" } } },
  ]);
  const applyBySource = new Map(applies.map((job) => [job._id, job]));
  const now = Date.now();
  const sourceFreshness = registered.map((source) => {
    const latestApply = applyBySource.get(source.id);
    const completedAt = latestApply?.completedAt || null;
    const sourceGeneratedAt = latestApply?.sourceGeneratedAt || null;
    const freshnessAt = source.freshnessUsesSourceTimestamp ? sourceGeneratedAt : completedAt;
    const maxAgeMs = source.freshnessMaxAgeHours ? source.freshnessMaxAgeHours * 60 * 60 * 1000 : null;
    const freshness = !freshnessAt || !maxAgeMs
      ? "UNKNOWN"
      : now - new Date(freshnessAt).getTime() <= maxAgeMs ? "CURRENT" : "STALE";
    return { id: source.id, name: source.name, freshness, lastUpdatedAt: completedAt, sourceGeneratedAt, freshnessMaxAgeHours: source.freshnessMaxAgeHours || null, freshnessUsesSourceTimestamp: source.freshnessUsesSourceTimestamp === true };
  });
  const fresh = sourceFreshness.every((source) => source.freshness === "CURRENT");
  const notes = sourceFreshness.flatMap((source) => source.freshness === "CURRENT"
    ? []
    : [`${source.name} source freshness is ${source.freshness.toLowerCase()}; run a manual refresh and apply it successfully`]);
  notes.push("Configured source coverage is incomplete; additional chain and intelligence categories remain unavailable");
  return { fresh, sources: sourceFreshness.map((source) => source.name), sourceFreshness, notes };
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

  const [records, transferResult, intelligenceCoverage, issuerFreezeStatus, addressRiskStatus] = await Promise.all([
    IntelligenceRecord.find({ chain: normalized.chain, address: normalized.address, isActive: true }).limit(50).lean(),
    adapter.getAddressTransactions({ address: normalized.address, depth: request.depth }),
    getIntelligenceCoverage(normalized.chain),
    typeof adapter.getIssuerFreezeStatus === "function"
      ? adapter.getIssuerFreezeStatus({ address: normalized.address })
      : Promise.resolve({ matches: [], errors: [], checkedAt: null }),
    normalized.chain === "TRON" && typeof adapter.getAddressRiskSignals === "function"
      ? adapter.getAddressRiskSignals({ address: normalized.address })
      : Promise.resolve({ matches: [], errors: [], configured: false, checkedAt: null }),
  ]);
  const transactions = normalizeAdapterTransactions(normalized.chain, normalized.address, transferResult, adapter.status, request.depth);

  const directMatches = [
    ...records.map((record) => ({ ...record, source: record.sourceName })),
    ...(addressRiskStatus.matches || []),
  ];
  const exposure = await collectCounterpartyExposure(normalized.chain, normalized.address, transactions, request.depth);
  const providerStatus = transferResult.providerStatus || adapter.status;
  const providerErrors = providerStatus === "UNAVAILABLE"
    ? ["Blockchain transaction provider is unavailable or its request failed"]
    : [];
  providerErrors.push(...(issuerFreezeStatus.errors || []));
  providerErrors.push(...(addressRiskStatus.errors || []));
  const issuerStatusNote = normalized.chain === "BSC"
    ? "No native issuer freeze contract is configured for BSC; wrapped/bridged tokens are outside this check"
    : issuerFreezeStatus.errors?.length
      ? "An issuer blocklist state could not be queried; no negative result is inferred"
      : issuerFreezeStatus.checkedAt
        ? "Issuer token blocklist status was queried from the configured chain provider"
        : "Issuer token blocklist status is unavailable in the selected provider mode";
  const addressRiskStatusNote = normalized.chain !== "TRON"
    ? null
    : !addressRiskStatus.configured
      ? "TRONSCAN account-security risk flags are not configured"
      : addressRiskStatus.errors?.length
        ? "TRONSCAN account-security risk flags could not be queried; no negative result is inferred"
        : "TRONSCAN account-security risk flags were queried live";
  const sourceNames = [...intelligenceCoverage.sources];
  if (addressRiskStatus.configured) sourceNames.push("TRONSCAN Account Security API");
  const coverage = {
    complete: false,
    fresh: intelligenceCoverage.fresh,
    sources: sourceNames,
    sourceFreshness: intelligenceCoverage.sourceFreshness,
    notes: [...intelligenceCoverage.notes, issuerStatusNote, ...(addressRiskStatusNote ? [addressRiskStatusNote] : []), transferResult.dataLabel === "SIMULATED_FIXTURE" ? "Blockchain data is simulated fixture output" : providerStatus === "LIVE" ? "Live provider history is bounded and does not cover every transaction type" : "Blockchain history provider is unavailable"],
  };
  if (exposure.truncated) coverage.notes.push("Counterparty exposure reached its wallet or intelligence-record limit; additional matches may be omitted");
  const risk = calculateRisk({
    chain: normalized.chain,
    address: normalized.address,
    directMatches,
    exposureFindings: exposure.findings,
    behaviorFindings: [],
    issuerFreezeMatches: issuerFreezeStatus.matches,
    coverage,
    providerErrors,
    providerStatus,
  });

  risk.exposureSummary.truncated = exposure.truncated;
  const screening = await Screening.create({
    userId: new mongoose.Types.ObjectId(userId),
    chain: normalized.chain,
    address: normalized.address,
    transactionHash,
    investigationDepth: request.depth,
    transactionSnapshot: transactions,
    transactionDataTruncated: Array.isArray(transferResult?.data) && transferResult.data.length >= 500,
    verdict: risk.verdict,
    riskScore: risk.riskScore,
    riskFactors: risk.riskFactors,
    matchedRecords: risk.matchedRecords,
    exposureSummary: { ...risk.exposureSummary, truncated: exposure.truncated },
    behaviorSummary: risk.behaviorSummary,
    coverage: risk.coverage,
    providerStatus: risk.providerStatus,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    riskModelVersion: risk.riskModelVersion,
    recommendedAction: risk.recommendedAction,
  });

  const saved = screening.toObject();
  delete saved.transactionSnapshot;
  return { screening: saved, risk, transactionData: { status: providerStatus, label: transferResult.dataLabel || null, transactions: transferResult.data || [] } };
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

export async function getScreening(userId, screeningId, { includeTransactions = false } = {}) {
  if (!mongoose.isValidObjectId(screeningId)) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  const query = Screening.findOne({ _id: screeningId, userId });
  if (includeTransactions) query.select("+transactionSnapshot");
  const screening = await query.lean();
  if (!screening) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  return screening;
}

export async function deleteScreening(userId, screeningId) {
  if (!mongoose.isValidObjectId(screeningId)) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
  const result = await Screening.deleteOne({ _id: screeningId, userId });
  if (result.deletedCount !== 1) throw httpError(404, "SCREENING_NOT_FOUND", "Screening was not found");
}

export async function reinvestigateScreening(userId, screeningId, depth) {
  const previous = await getScreening(userId, screeningId);
  return createScreening(userId, { chain: previous.chain, address: previous.address, transactionHash: previous.transactionHash || undefined, depth: depth || previous.investigationDepth || 1 });
}
