import { BlockchainAdapter } from "./adapter.js";
import { errorResult, getJson, postJson } from "./provider-http.js";
import { env } from "../../config/env.js";
import { chains, isValidAddress, normalizeAddress, tronAddressToBase58 } from "../../config/chains.js";

const maxPages = 3;

function decimalFromInteger(value, decimals = 0) {
  try {
    const places = Math.min(36, Math.max(0, Number(decimals) || 0));
    const integer = BigInt(value || "0");
    const scale = 10n ** BigInt(places);
    const fraction = (integer % scale).toString().padStart(places, "0").replace(/0+$/, "");
    return fraction ? `${integer / scale}.${fraction}` : (integer / scale).toString();
  } catch { return "0"; }
}

export class TronGridAdapter extends BlockchainAdapter {
  constructor() {
    super("TRON");
    this.url = env.TRON_RPC_URL.replace(/\/+$/, "");
    this.apiKey = env.TRON_API_KEY;
    this.tronscanApiKey = env.TRONSCAN_API_KEY;
    this.status = this.url && this.apiKey ? "LIVE" : "UNAVAILABLE";
  }

  validateAddress(address) { return isValidAddress("TRON", address); }
  normalizeAddress(address) { return normalizeAddress("TRON", address).address; }

  async request(path, params = {}) {
    const query = new URLSearchParams(params);
    const suffix = query.toString() ? `?${query}` : "";
    return getJson(`${this.url}${path}${suffix}`, { "TRON-PRO-API-KEY": this.apiKey });
  }

  async getNativeBalance({ address }) {
    try {
      const account = this.normalizeAddress(address);
      const result = await this.request(`/v1/accounts/${encodeURIComponent(account)}`);
      return { providerStatus: "LIVE", data: { amount: decimalFromInteger(result.data?.[0]?.balance, 6), symbol: "TRX" } };
    } catch { return errorResult(); }
  }

  async getTransaction({ transactionHash }) {
    try {
      const result = await this.request(`/v1/transactions/${encodeURIComponent(transactionHash)}`);
      return { providerStatus: "LIVE", data: result.data?.[0] || null };
    } catch { return errorResult(); }
  }

  async getIssuerFreezeStatus({ address }) {
    const checkedAt = new Date();
    if (this.status !== "LIVE") return { matches: [], errors: ["ISSUER_STATUS_PROVIDER_UNAVAILABLE"], checkedAt };
    try {
      const normalized = this.normalizeAddress(address);
      const parameter = normalized.slice(2).padStart(64, "0");
      const response = await postJson(`${this.url}/wallet/triggerconstantcontract`, {
        owner_address: normalized,
        contract_address: normalizeAddress("TRON", chains.TRON.tokenContracts.USDT).address,
        function_selector: "isBlackListed(address)",
        parameter,
        visible: false,
      }, { "TRON-PRO-API-KEY": this.apiKey });
      const encoded = String(response.constant_result?.[0] || "").replace(/^0x/i, "");
      if (response.result?.result !== true || !/^[\da-fA-F]{64,}$/.test(encoded)) throw new Error("INVALID_ISSUER_STATUS_RESPONSE");
      const frozen = BigInt(`0x${encoded}`) !== 0n;
      return {
        matches: frozen ? [{ category: "FROZEN", riskLevel: "CRITICAL", confirmed: true, confidence: 1, entityName: "USDT contract blocklist", sourceName: "Tether USDT issuer freeze status", sourceId: "issuer-freeze-usdt-tron", sourceUrl: "https://tronscan.org/#/token20/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", effectiveAt: checkedAt, description: "Tether's USDT contract reports this address as currently blocked at the latest TRON state." }] : [],
        errors: [], checkedAt,
      };
    } catch {
      return { matches: [], errors: ["ISSUER_STATUS_QUERY_FAILED"], checkedAt };
    }
  }

  async getAddressRiskSignals({ address }) {
    if (!this.tronscanApiKey) return { matches: [], errors: [], configured: false, checkedAt: null };
    const checkedAt = new Date();
    try {
      const normalized = this.normalizeAddress(address);
      const base58Address = tronAddressToBase58(normalized);
      if (!base58Address) throw new Error("INVALID_TRON_ADDRESS");
      const url = new URL("https://apilist.tronscanapi.com/api/security/account/data");
      url.searchParams.set("address", base58Address);
      const result = await getJson(url.toString(), { "TRON-PRO-API-KEY": this.tronscanApiKey });
      const flags = ["send_ad_by_memo", "has_fraud_transaction", "fraud_token_creator", "is_black_list"];
      if (flags.some((flag) => typeof result?.[flag] !== "boolean")) throw new Error("INVALID_TRONSCAN_SECURITY_RESPONSE");
      const sourceUrl = `https://tronscan.org/#/address/${encodeURIComponent(base58Address)}`;
      const flagFindings = [
        ["has_fraud_transaction", "SCAM", "HIGH", "Fraudulent transaction history"],
        ["fraud_token_creator", "SCAM", "HIGH", "Fraudulent token creator"],
        ["send_ad_by_memo", "SCAM", "MEDIUM", "Advertising spam by transaction memo"],
      ];
      const matches = flagFindings.filter(([flag]) => result[flag]).map(([flag, category, riskLevel, label]) => ({
        category,
        riskLevel,
        confirmed: false,
        confidence: 0.75,
        entityName: label,
        sourceName: "TRONSCAN Account Security API",
        sourceId: `tronscan-${flag.replaceAll("_", "-")}`,
        sourceUrl,
        effectiveAt: checkedAt,
        description: `TRONSCAN's account-security API flagged this address for ${label.toLowerCase()}. This is an attributed risk signal, not an adjudicated finding.`,
      }));
      if (result.is_black_list) matches.push({
        category: "FROZEN",
        riskLevel: "HIGH",
        confirmed: false,
        confidence: 0.75,
        entityName: "TRONSCAN stablecoin blacklist flag",
        sourceName: "TRONSCAN Account Security API",
        sourceId: "tronscan-stablecoin-blacklist",
        sourceUrl,
        effectiveAt: checkedAt,
        description: "TRONSCAN reports a stablecoin blacklist flag for this address; this is not a direct issuer contract read.",
      });
      return { matches, errors: [], configured: true, checkedAt };
    } catch {
      return { matches: [], errors: ["TRONSCAN_SECURITY_QUERY_FAILED"], configured: true, checkedAt };
    }
  }

  async getAddressTransactions({ address }) {
    const account = this.normalizeAddress(address);
    const transactions = new Map();
    let truncated = false;
    try {
      for (const path of [
        `/v1/accounts/${encodeURIComponent(account)}/transactions`,
        `/v1/accounts/${encodeURIComponent(account)}/transactions/trc20`,
      ]) {
        let fingerprint;
        for (let page = 0; page < maxPages; page += 1) {
          const params = { only_confirmed: "true", limit: "200", order_by: "block_timestamp,desc" };
          if (fingerprint) params.fingerprint = fingerprint;
          const result = await this.request(path, params);
          for (const row of result.data || []) {
            if (row.transaction_id && row.from && row.to && row.value != null) {
              const token = row.token_info || {};
              const transfer = {
                transactionHash: row.transaction_id,
                eventIndex: Number(row.event_index ?? 0),
                fromAddress: row.from,
                toAddress: row.to,
                amount: decimalFromInteger(row.value, token.decimals),
                symbol: token.symbol || "TRC20",
                assetId: token.address || "tron:trc20-unknown",
                timestamp: row.block_timestamp,
              };
              transactions.set(`${transfer.transactionHash}:${transfer.eventIndex}`, transfer);
              continue;
            }
            if (row.txID && row.raw_data?.contract?.length) {
              for (let index = 0; index < row.raw_data.contract.length; index += 1) {
                const contract = row.raw_data.contract[index];
                if (contract.type !== "TransferContract") continue;
                const transferData = contract.parameter?.value || {};
                if (!transferData.owner_address || !transferData.to_address) continue;
                const transfer = {
                  transactionHash: row.txID,
                  eventIndex: index,
                  fromAddress: transferData.owner_address,
                  toAddress: transferData.to_address,
                  amount: decimalFromInteger(transferData.amount, 6),
                  symbol: "TRX",
                  assetId: "tron:native",
                  timestamp: row.block_timestamp,
                };
                transactions.set(`${transfer.transactionHash}:${transfer.eventIndex}`, transfer);
              }
            }
          }
          fingerprint = result.meta?.fingerprint;
          if (!fingerprint) break;
          if (page === maxPages - 1) truncated = true;
        }
      }
      const data = [...transactions.values()].slice(0, 500);
      return {
        providerStatus: "LIVE",
        data,
        dataLabel: "LIVE_SOURCE",
        coverage: { complete: !truncated && transactions.size <= 500, fresh: true, scope: "confirmed TRX and TRC-20 account history" },
      };
    } catch {
      return { ...errorResult(), dataLabel: null };
    }
  }

  async getTokenTransfers({ address }) { return this.getAddressTransactions({ address }); }
}
