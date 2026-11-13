import { IntelligenceRecord } from "../../models/intelligence-record.js";

const severity = { LOW: 20, MEDIUM: 42, HIGH: 68, CRITICAL: 90 };

// Connectivity is undirected; it does not establish the flow or provenance of funds.
export async function collectCounterpartyExposure(chain, rootAddress, transactions, depth = 1) {
  const distances = new Map([[rootAddress, 0]]);
  let frontier = [rootAddress];
  let truncated = false;
  for (let hop = 1; hop <= Math.min(2, depth) && frontier.length; hop += 1) {
    const current = new Set(frontier);
    const next = new Set();
    for (const transaction of transactions.slice(0, 500)) {
      if (transaction.chain !== chain) continue;
      if (!current.has(transaction.fromAddress) && !current.has(transaction.toAddress)) continue;
      for (const address of [transaction.fromAddress, transaction.toAddress]) {
        if (distances.has(address)) continue;
        if (distances.size >= 250) { truncated = true; continue; }
        distances.set(address, hop);
        next.add(address);
      }
    }
    frontier = [...next];
  }
  distances.delete(rootAddress);
  if (!distances.size) return { findings: [], truncated };

  const records = await IntelligenceRecord.find({ chain, address: { $in: [...distances.keys()] }, isActive: true })
    .select("address riskLevel confidence category entityName sourceId sourceName sourceUrl lastSeenAt effectiveAt")
    .sort({ address: 1, _id: 1 }).limit(501).lean();
  if (records.length > 500) truncated = true;
  const strongest = new Map();
  for (const record of records.slice(0, 500)) {
    const strength = (severity[record.riskLevel] || 0) * (record.confidence ?? 0.5);
    const previous = strongest.get(record.address);
    if (!previous || strength > previous.strength) strongest.set(record.address, { record, strength });
  }
  const simulated = transactions.some((transaction) => transaction.dataLabel === "SIMULATED_FIXTURE");
  return {
    truncated,
    findings: [...strongest.values()].map(({ record }) => ({
      ...record,
      recordId: String(record._id),
      counterpartyAddress: record.address,
      distance: distances.get(record.address),
      dataLabel: simulated ? "SIMULATED_FIXTURE" : "LIVE_SOURCE",
      // A connected edge's value is not an attributable exposure amount.
      exposureValueUsd: null,
    })),
  };
}
