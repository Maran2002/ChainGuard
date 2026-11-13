import mongoose from "mongoose";
import { Screening } from "../../models/screening.js";
import { IngestionJob } from "../../models/ingestion-job.js";
import { getBlockchainProviderStatuses } from "../../adapters/blockchain/registry.js";
import { listIntelligenceSources } from "../../adapters/intelligence/registry.js";

const verdicts = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const periodDays = 28;
const dayMs = 24 * 60 * 60 * 1000;
const istOffsetMs = 330 * 60 * 1000;

function istDateKey(date) {
  return new Date(date.getTime() + istOffsetMs).toISOString().slice(0, 10);
}

function makeDaySeries(aggregateRows, start) {
  const rows = new Map(aggregateRows.map((row) => [row._id, row]));
  return Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(start.getTime() + index * dayMs);
    const key = istDateKey(date);
    const row = rows.get(key);
    return { date: key, total: row?.total || 0, highRisk: row?.highRisk || 0 };
  });
}

export async function getDashboardSummary(userId) {
  const accountId = new mongoose.Types.ObjectId(userId);
  const todayIstStart = Math.floor((Date.now() + istOffsetMs) / dayMs) * dayMs - istOffsetMs;
  const end = new Date(todayIstStart + dayMs);
  const start = new Date(end.getTime() - periodDays * dayMs);
  const match = { userId: accountId, screenedAt: { $gte: start, $lt: end } };

  const [total, distributionRows, dailyRows, walletRows, recent, providerStatuses] = await Promise.all([
    Screening.countDocuments(match),
    Screening.aggregate([{ $match: match }, { $group: { _id: "$verdict", count: { $sum: 1 } } }]),
    Screening.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$screenedAt", timezone: "Asia/Kolkata" } },
        total: { $sum: 1 },
        highRisk: { $sum: { $cond: [{ $in: ["$verdict", ["CRITICAL", "HIGH"]] }, 1, 0] } },
      } },
      { $sort: { _id: 1 } },
    ]),
    Screening.aggregate([{ $match: match }, { $group: { _id: { chain: "$chain", address: "$address" } } }, { $count: "total" }]),
    Screening.find(match).sort({ screenedAt: -1, _id: -1 }).limit(6)
      .select("chain address verdict riskScore providerStatus screenedAt matchedRecords investigationDepth transactionDataTruncated")
      .lean(),
    Promise.resolve(getBlockchainProviderStatuses()),
  ]);

  const distribution = Object.fromEntries(verdicts.map((verdict) => [verdict, 0]));
  for (const row of distributionRows) if (Object.hasOwn(distribution, row._id)) distribution[row._id] = row.count;

  const registeredSources = listIntelligenceSources();
  const sourceIds = registeredSources.map((source) => source.id);
  const [latestJobs, latestSuccessfulApplies] = sourceIds.length ? await Promise.all([
    IngestionJob.aggregate([
      { $match: { sourceId: { $in: sourceIds } } },
      { $sort: { startedAt: -1 } },
      { $group: { _id: "$sourceId", status: { $first: "$status" }, startedAt: { $first: "$startedAt" } } },
    ]),
    IngestionJob.aggregate([
      { $match: { sourceId: { $in: sourceIds }, status: "SUCCEEDED", dryRun: false, completedAt: { $ne: null } } },
      { $sort: { completedAt: -1 } },
      { $group: { _id: "$sourceId", completedAt: { $first: "$completedAt" }, sourceGeneratedAt: { $first: "$sourceGeneratedAt" } } },
    ]),
  ]) : [[], []];
  const jobBySource = new Map(latestJobs.map((job) => [job._id, job]));
  const successBySource = new Map(latestSuccessfulApplies.map((job) => [job._id, job]));
  const sources = [
    ...Object.entries(providerStatuses).map(([chain, status]) => ({
      id: `chain:${chain}`,
      name: chain,
      kind: "BLOCKCHAIN",
      status,
      freshness: "UNKNOWN",
      note: status === "MOCK" ? "Deterministic fixtures only" : status === "UNAVAILABLE" ? "Provider not configured" : "Provider connected; freshness not checked",
      lastUpdatedAt: null,
    })),
    ...registeredSources.map((source) => {
      const job = jobBySource.get(source.id);
      const successfulApply = successBySource.get(source.id);
      const maxAgeMs = source.freshnessMaxAgeHours ? source.freshnessMaxAgeHours * 60 * 60 * 1000 : null;
      const completedAt = successfulApply?.completedAt || null;
      const sourceGeneratedAt = successfulApply?.sourceGeneratedAt || null;
      const freshnessAt = source.freshnessUsesSourceTimestamp ? sourceGeneratedAt : completedAt;
      const freshness = !freshnessAt || !maxAgeMs
        ? "UNKNOWN"
        : Date.now() - new Date(freshnessAt).getTime() <= maxAgeMs ? "CURRENT" : "STALE";
      return {
        id: source.id,
        name: source.name,
        kind: "INTELLIGENCE",
        status: job?.status || "NOT_SYNCED",
        freshness,
        freshnessMaxAgeHours: source.freshnessMaxAgeHours || null,
        note: job?.status === "FAILED"
          ? `Latest run failed; last successful apply ${completedAt ? "is shown separately" : "has not been recorded"}`
          : source.updateCadence || "Manual updates; freshness threshold not set",
        lastUpdatedAt: completedAt,
        sourceGeneratedAt,
      };
    }),
  ];
  const configuredSources = sources.filter((source) => ["LIVE", "MOCK", "SUCCEEDED", "DRY_RUN", "PARTIAL"].includes(source.status)).length;

  return {
    period: { days: periodDays, start, end: new Date(end.getTime() - 1) },
    metrics: {
      screenings: total,
      highRisk: distribution.CRITICAL + distribution.HIGH,
      uniqueWallets: walletRows[0]?.total || 0,
      configuredSources,
      sourceCount: sources.length,
    },
    distribution,
    daily: makeDaySeries(dailyRows, start),
    sources,
    recent,
  };
}
