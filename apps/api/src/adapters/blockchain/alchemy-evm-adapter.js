import { BlockchainAdapter } from "./adapter.js";
import { errorResult, postJson } from "./provider-http.js";
import { env } from "../../config/env.js";
import { chains, isValidAddress, normalizeAddress } from "../../config/chains.js";

const nativeAssets = { ETHEREUM: "ETH", BSC: "BNB" };
const categories = ["external", "erc20"];
const pageLimit = 5;
const bscHistoryPageLimit = 3;
const bscHistoryPageSize = 100;
const nodeRealBscBaseUrl = "https://bsc-mainnet.nodereal.io/v1/";
// NodeReal documents this shared key for development use; custom keys remain server-side.
const nodeRealSharedApiKey = "64a9df0874fb4a93b9d0a3849de012d3";

function toDecimal(raw, decimals) {
  try {
    const value = BigInt(raw || "0");
    const places = Math.min(36, Math.max(0, Number(decimals) || 0));
    const scale = 10n ** BigInt(places);
    const whole = value / scale;
    const fraction = (value % scale).toString().padStart(places, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch { return "0"; }
}

export class AlchemyEvmAdapter extends BlockchainAdapter {
  constructor(chain) {
    super(chain);
    this.url = env[`${chain}_RPC_URL`];
    this.nodeRealApiKey = chain === "BSC" ? env.NODEREAL_API_KEY || nodeRealSharedApiKey : "";
    this.usesSharedNodeRealKey = chain === "BSC" && !env.NODEREAL_API_KEY;
    this.status = this.url ? "LIVE" : "UNAVAILABLE";
  }

  validateAddress(address) { return isValidAddress(this.chain, address); }
  normalizeAddress(address) { return normalizeAddress(this.chain, address).address; }

  async rpc(method, params) {
    const payload = await postJson(this.url, { jsonrpc: "2.0", id: 1, method, params });
    return payload.result;
  }

  async getNativeBalance({ address }) {
    try {
      const result = await this.rpc("eth_getBalance", [this.normalizeAddress(address), "latest"]);
      return { providerStatus: "LIVE", data: { amount: toDecimal(result, 18), symbol: nativeAssets[this.chain] } };
    } catch { return errorResult(); }
  }

  async getTransaction({ transactionHash }) {
    try {
      return { providerStatus: "LIVE", data: await this.rpc("eth_getTransactionByHash", [transactionHash]) };
    } catch { return errorResult(); }
  }

  async getIssuerFreezeStatus({ address }) {
    const checkedAt = new Date();
    if (this.chain !== "ETHEREUM" || this.status !== "LIVE") return { matches: [], errors: this.status === "LIVE" ? [] : ["ISSUER_STATUS_PROVIDER_UNAVAILABLE"], checkedAt };
    const normalized = this.normalizeAddress(address);
    const contracts = chains.ETHEREUM.tokenContracts;
    const calls = [
      { token: "USDT", selector: "e47d6060", functionName: "isBlackListed(address)", contract: contracts.USDT, sourceName: "Tether USDT issuer freeze status", sourceUrl: "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7" },
      { token: "USDC", selector: "fe575a87", functionName: "isBlacklisted(address)", contract: contracts.USDC, sourceName: "Circle USDC issuer freeze status", sourceUrl: "https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    ];
    const results = await Promise.allSettled(calls.map(async (call) => {
      const data = `0x${call.selector}${normalized.slice(2).padStart(64, "0")}`;
      const response = await this.rpc("eth_call", [{ to: call.contract, data }, "latest"]);
      if (typeof response !== "string" || !/^0x[\da-fA-F]{64,}$/.test(response)) throw new Error("INVALID_ISSUER_STATUS_RESPONSE");
      return { ...call, frozen: BigInt(response) !== 0n };
    }));
    const matches = [];
    const errors = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "rejected") {
        errors.push("ISSUER_STATUS_QUERY_FAILED");
        continue;
      }
      if (result.value.frozen) matches.push({ category: "FROZEN", riskLevel: "CRITICAL", confirmed: true, confidence: 1, entityName: `${result.value.token} contract blocklist`, sourceName: result.value.sourceName, sourceId: `issuer-freeze-${result.value.token.toLowerCase()}-ethereum`, sourceUrl: result.value.sourceUrl, effectiveAt: checkedAt, description: `${result.value.token} issuer contract reports this address as currently blocked at the latest Ethereum state.` });
    }
    return { matches, errors: [...new Set(errors)], checkedAt };
  }

  async getAddressTransactions({ address }) {
    if (this.chain === "BSC") {
      return this.getBscAddressTransactions({ address });
    }
    const normalizedAddress = this.normalizeAddress(address);
    const transfers = new Map();
    let truncated = false;
    try {
      for (const direction of ["fromAddress", "toAddress"]) {
        let pageKey;
        for (let page = 0; page < pageLimit; page += 1) {
          const filter = {
            [direction]: normalizedAddress,
            category: categories,
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: "0x64",
            order: "desc",
          };
          if (pageKey) filter.pageKey = pageKey;
          const result = await this.rpc("alchemy_getAssetTransfers", [filter]);
          for (const item of result?.transfers || []) {
            const decimals = item.rawContract?.decimal ?? (item.category === "external" ? 18 : 0);
            const amount = item.rawContract?.value
              ? toDecimal(item.rawContract.value, decimals)
              : String(item.value ?? "0");
            const eventIndex = item.logIndex == null ? 0 : Number(item.logIndex);
            const transaction = {
              transactionHash: item.hash,
              eventIndex,
              fromAddress: item.from,
              toAddress: item.to,
              amount,
              symbol: item.asset || (item.category === "external" ? nativeAssets[this.chain] : "TOKEN"),
              assetId: item.rawContract?.address || `${this.chain.toLowerCase()}:native`,
              timestamp: item.metadata?.blockTimestamp || null,
            };
            transfers.set(`${transaction.transactionHash}:${transaction.eventIndex}`, transaction);
          }
          pageKey = result?.pageKey;
          if (!pageKey) break;
          if (page === pageLimit - 1) truncated = true;
        }
      }
      return {
        providerStatus: "LIVE",
        data: [...transfers.values()].slice(0, 500),
        dataLabel: "LIVE_SOURCE",
        coverage: { complete: !truncated && transfers.size <= 500, fresh: true, scope: "Alchemy external and ERC-20 transfer history" },
      };
    } catch {
      return { ...errorResult(), dataLabel: null };
    }
  }

  async getBscAddressTransactions({ address }) {
    const normalizedAddress = this.normalizeAddress(address);
    const transfers = new Map();
    const tokenEventIndexes = new Map();
    let truncated = false;
    try {
      for (const resource of [
        { category: "external", kind: "native" },
        { category: "20", kind: "erc20" },
      ]) {
        for (const direction of ["fromAddress", "toAddress"]) {
          let pageKey;
          const maxPages = this.usesSharedNodeRealKey ? 1 : bscHistoryPageLimit;
          for (let page = 0; page < maxPages; page += 1) {
            const filter = {
              category: [resource.category],
              [direction]: normalizedAddress,
              order: "desc",
              excludeZeroValue: true,
              maxCount: `0x${bscHistoryPageSize.toString(16)}`,
              ...(pageKey ? { pageKey } : {}),
            };
            const payload = await postJson(`${nodeRealBscBaseUrl}${this.nodeRealApiKey}`, {
              jsonrpc: "2.0",
              id: 1,
              method: "nr_getAssetTransfers",
              params: [filter],
            });
            const rows = payload?.result?.transfers;
            if (!Array.isArray(rows)) throw new Error("Invalid NodeReal indexed history response");
            for (const item of rows) {
              const transactionHash = item.hash;
              const fromAddress = item.from;
              const toAddress = item.to;
              if (!transactionHash || !fromAddress || !toAddress) continue;
              const tokenAddress = item.contractAddress || "bsc:erc20-unknown";
              const signature = resource.kind === "native"
                ? `${transactionHash}:native`
                : `${transactionHash}:erc20:${fromAddress.toLowerCase()}:${toAddress.toLowerCase()}:${tokenAddress.toLowerCase()}:${item.value || "0"}`;
              let eventIndex = 0;
              if (resource.kind === "erc20") {
                const reportedLogIndex = item.logIndex == null ? null : Number(item.logIndex);
                if (Number.isInteger(reportedLogIndex) && reportedLogIndex >= 0) {
                  eventIndex = reportedLogIndex + 1;
                } else {
                  if (!tokenEventIndexes.has(transactionHash)) tokenEventIndexes.set(transactionHash, new Map());
                  const indexes = tokenEventIndexes.get(transactionHash);
                  if (!indexes.has(signature)) indexes.set(signature, indexes.size + 1);
                  eventIndex = indexes.get(signature);
                }
              }
              transfers.set(signature, {
                transactionHash,
                eventIndex,
                fromAddress,
                toAddress,
                amount: toDecimal(item.value ?? "0", resource.kind === "native" ? 18 : item.decimal ?? 0),
                symbol: resource.kind === "native" ? nativeAssets.BSC : item.asset || "TOKEN",
                assetId: resource.kind === "native" ? "bsc:native" : tokenAddress,
                timestamp: item.blockTimeStamp ?? item.blockTimestamp ?? null,
              });
            }
            pageKey = payload.result.pageKey;
            if (!pageKey) break;
            if (page === maxPages - 1) truncated = true;
          }
        }
      }
      const resourceCounts = { native: 0, erc20: 0 };
      for (const transfer of transfers.values()) resourceCounts[transfer.assetId === "bsc:native" ? "native" : "erc20"] += 1;
      return {
        providerStatus: "LIVE",
        data: [...transfers.values()].slice(0, 500),
        dataLabel: "LIVE_SOURCE",
        coverage: {
          complete: !truncated && transfers.size <= 500,
          fresh: true,
          scope: this.usesSharedNodeRealKey
            ? "NodeReal indexed BSC native transactions and ERC-20 transfers (shared public key; one page per direction and resource)"
            : "NodeReal indexed BSC native transactions and ERC-20 transfers (up to 3 pages per direction and resource)",
          nativeRows: resourceCounts.native,
          erc20Rows: resourceCounts.erc20,
        },
      };
    } catch {
      return { ...errorResult(), dataLabel: null };
    }
  }

  async getTokenTransfers({ address }) { return this.getAddressTransactions({ address }); }
}
