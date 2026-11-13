import { normalizeAddress } from "../../config/chains.js";

const transactionHashPattern = /^(0x)?[a-fA-F0-9]{64}$/;
const amountPattern = /^\d{1,70}(\.\d{1,28})?$/;
const maxTransactionsPerResponse = 500;

function normalizeTimestamp(value) {
  if (value == null || value === "") return null;
  const input = typeof value === "number" && value < 1000000000000 ? value * 1000 : value;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeAdapterTransactions(chain, address, response, providerStatus, depth = 1) {
  if (!Array.isArray(response?.data) || providerStatus === "UNAVAILABLE") return [];
  const anchor = normalizeAddress(chain, address).address;
  const dataLabel = response.dataLabel === "SIMULATED_FIXTURE" || providerStatus === "MOCK" ? "SIMULATED_FIXTURE" : "LIVE_SOURCE";
  const normalized = new Map();
  for (const raw of response.data.slice(0, maxTransactionsPerResponse)) {
    try {
      const transactionHash = String(raw.transactionHash || raw.hash || "").toLowerCase();
      const eventIndex = Number(raw.eventIndex ?? raw.logIndex ?? 0);
      if (!transactionHashPattern.test(transactionHash) || !Number.isInteger(eventIndex) || eventIndex < 0 || eventIndex > 1000000) continue;
      const from = normalizeAddress(chain, raw.fromAddress || raw.from);
      const to = normalizeAddress(chain, raw.toAddress || raw.to);
      const amount = String(raw.amount ?? "0");
      if (!amountPattern.test(amount)) continue;
      const valueUsd = raw.valueUsd == null ? null : Number(raw.valueUsd);
      if (valueUsd != null && (!Number.isFinite(valueUsd) || valueUsd < 0)) continue;
      const key = `${transactionHash}:${eventIndex}`;
      normalized.set(key, {
        chain,
        transactionHash,
        eventIndex,
        fromAddress: from.address,
        toAddress: to.address,
        assetId: typeof raw.assetId === "string" ? raw.assetId.trim().slice(0, 160) || "native" : "native",
        symbol: typeof raw.symbol === "string" ? raw.symbol.trim().slice(0, 32) || "NATIVE" : "NATIVE",
        amount,
        valueUsd,
        blockTimestamp: normalizeTimestamp(raw.blockTimestamp ?? raw.timestamp),
        providerStatus: providerStatus === "MOCK" ? "MOCK" : "LIVE",
        dataLabel,
      });
    } catch {
      // Malformed provider rows are ignored; raw provider payloads are not logged.
    }
  }
  const reachable = new Map();
  const visited = new Set([anchor]);
  let frontier = [anchor];
  for (let hop = 1; hop <= Math.min(2, depth) && frontier.length; hop += 1) {
    const next = new Set();
    for (const [key, transaction] of normalized) {
      if (reachable.has(key)) continue;
      if (!frontier.includes(transaction.fromAddress) && !frontier.includes(transaction.toAddress)) continue;
      reachable.set(key, transaction);
      for (const endpoint of [transaction.fromAddress, transaction.toAddress]) if (!visited.has(endpoint)) next.add(endpoint);
    }
    for (const addressInGraph of next) visited.add(addressInGraph);
    frontier = [...next];
  }
  return [...reachable.values()];
}
