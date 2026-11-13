import { IntelligenceRecord } from "../../models/intelligence-record.js";
import { getScreening } from "../screening/screening-service.js";

const maxNodes = 250;
const maxEdges = 500;
const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export async function getScreeningGraph(userId, screeningId, depth = 1) {
  const screening = await getScreening(userId, screeningId, { includeTransactions: true });
  const snapshotAvailable = Array.isArray(screening.transactionSnapshot);
  const snapshot = screening.transactionSnapshot || [];
  const screeningDepth = screening.investigationDepth || 1;
  const traversalDepth = Math.min(depth, screeningDepth);
  const rootAddress = screening.address;
  const nodes = new Map([[rootAddress, { address: rootAddress, kind: "ROOT", chain: screening.chain, riskLevel: null, entityName: null }]]);
  const edges = new Map();
  const visited = new Set([rootAddress]);
  let frontier = [rootAddress];
  let truncated = screening.transactionDataTruncated === true;

  for (let hop = 1; hop <= traversalDepth && frontier.length; hop += 1) {
    const remaining = maxEdges - edges.size;
    if (remaining <= 0) { truncated = true; break; }
    const frontierAddresses = new Set(frontier);
    const transactions = snapshot.filter((transaction) =>
      transaction.chain === screening.chain &&
      !edges.has(`${transaction.transactionHash}:${transaction.eventIndex}`) &&
      (frontierAddresses.has(transaction.fromAddress) || frontierAddresses.has(transaction.toAddress))
    ).sort((left, right) => (new Date(right.blockTimestamp || 0).getTime() - new Date(left.blockTimestamp || 0).getTime()) ||
      left.transactionHash.localeCompare(right.transactionHash) || left.eventIndex - right.eventIndex).slice(0, remaining + 1);
    if (transactions.length > remaining) truncated = true;
    const nextFrontier = new Set();
    for (const transaction of transactions.slice(0, remaining)) {
      const key = `${transaction.transactionHash}:${transaction.eventIndex}`;
      if (edges.has(key)) continue;
      const endpoints = [transaction.fromAddress, transaction.toAddress];
      const newEndpoints = new Set(endpoints.filter((address) => !nodes.has(address)));
      const exceedsNodeBudget = nodes.size + newEndpoints.size > maxNodes;
      if (exceedsNodeBudget) { truncated = true; continue; }
      for (const address of endpoints) {
        if (!nodes.has(address)) nodes.set(address, { address, kind: "COUNTERPARTY", chain: screening.chain, riskLevel: null, entityName: null });
        if (!visited.has(address)) nextFrontier.add(address);
      }
      edges.set(key, {
        id: key,
        transactionHash: transaction.transactionHash,
        eventIndex: transaction.eventIndex,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        assetId: transaction.assetId,
        symbol: transaction.symbol,
        amount: transaction.amount,
        valueUsd: transaction.valueUsd,
        blockTimestamp: transaction.blockTimestamp,
        providerStatus: transaction.providerStatus,
        dataLabel: transaction.dataLabel,
        hop,
      });
    }
    for (const address of nextFrontier) visited.add(address);
    frontier = [...nextFrontier].slice(0, maxNodes);
  }

  const addresses = [...nodes.keys()];
  const intel = await IntelligenceRecord.find({ chain: screening.chain, address: { $in: addresses }, isActive: true })
    .select("address riskLevel entityName").limit(maxNodes * 5).lean();
  for (const record of intel) {
    const node = nodes.get(record.address);
    if (!node) continue;
    if (!node.riskLevel || riskOrder[record.riskLevel] > riskOrder[node.riskLevel]) node.riskLevel = record.riskLevel;
    if (!node.entityName && record.entityName) node.entityName = record.entityName;
  }

  return {
    screeningId: String(screening._id),
    chain: screening.chain,
    rootAddress,
    requestedDepth: depth,
    screeningDepth,
    depth: traversalDepth,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    meta: {
      snapshotAvailable,
      transactionScope: snapshotAvailable ? "SCREENING_SNAPSHOT" : "LEGACY_SNAPSHOT_UNAVAILABLE",
      intelligenceScope: "CURRENT_DIRECTORY",
      nodeCount: nodes.size,
      edgeCount: edges.size,
      screeningDepth,
      truncated,
      providerWindowTruncated: screening.transactionDataTruncated === true,
      providerStatus: screening.providerStatus,
      coverageComplete: screening.coverage?.complete === true,
      coverageFresh: screening.coverage?.fresh === true,
      riskModelVersion: screening.riskModelVersion,
    },
  };
}
