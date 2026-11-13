import { BlockchainAdapter } from "./adapter.js";
import { isValidAddress, normalizeAddress } from "../../config/chains.js";

const fixtureGraphs = {
  TRON: {
    transactions: [
      { transactionHash: "1".repeat(64), eventIndex: 0, fromAddress: `41${"a1".repeat(20)}`, toAddress: `41${"b2".repeat(20)}`, amount: "1250.00", symbol: "USDT", assetId: "tron:usdt-fixture", valueUsd: 1250, timestamp: "2026-11-01T12:00:00.000Z" },
      { transactionHash: "2".repeat(64), eventIndex: 0, fromAddress: `41${"b2".repeat(20)}`, toAddress: `41${"c3".repeat(20)}`, amount: "200.00", symbol: "USDT", assetId: "tron:usdt-fixture", valueUsd: 200, timestamp: "2026-11-02T08:30:00.000Z" },
      { transactionHash: "3".repeat(64), eventIndex: 0, fromAddress: `41${"a1".repeat(20)}`, toAddress: `41${"d4".repeat(20)}`, amount: "42.5", symbol: "TRX", assetId: "tron:native-fixture", valueUsd: null, timestamp: "2026-11-03T15:15:00.000Z" },
    ],
  },
  ETHEREUM: {
    transactions: [
      { transactionHash: "4".repeat(64), eventIndex: 2, fromAddress: `0x${"11".repeat(20)}`, toAddress: `0x${"22".repeat(20)}`, amount: "4.25", symbol: "USDT", assetId: "ethereum:usdt-fixture", valueUsd: 4.25, timestamp: "2026-11-01T12:00:00.000Z" },
      { transactionHash: "5".repeat(64), eventIndex: 1, fromAddress: `0x${"22".repeat(20)}`, toAddress: `0x${"33".repeat(20)}`, amount: "1.5", symbol: "ETH", assetId: "ethereum:native-fixture", valueUsd: null, timestamp: "2026-11-02T08:30:00.000Z" },
    ],
  },
  BSC: {
    transactions: [
      { transactionHash: "6".repeat(64), eventIndex: 2, fromAddress: `0x${"44".repeat(20)}`, toAddress: `0x${"55".repeat(20)}`, amount: "90", symbol: "USDT", assetId: "bsc:usdt-fixture", valueUsd: 90, timestamp: "2026-11-01T12:00:00.000Z" },
      { transactionHash: "7".repeat(64), eventIndex: 1, fromAddress: `0x${"55".repeat(20)}`, toAddress: `0x${"66".repeat(20)}`, amount: "0.8", symbol: "BNB", assetId: "bsc:native-fixture", valueUsd: null, timestamp: "2026-11-02T08:30:00.000Z" },
    ],
  },
};

export class MockBlockchainAdapter extends BlockchainAdapter {
  constructor(chain) {
    super(chain);
    this.status = "MOCK";
  }

  validateAddress(address) {
    return isValidAddress(this.chain, address);
  }

  normalizeAddress(address) {
    return normalizeAddress(this.chain, address).address;
  }

  async getNativeBalance() {
    return { providerStatus: this.status, data: null, dataLabel: "SIMULATED_FIXTURE" };
  }

  async getTokenTransfers() {
    return { providerStatus: this.status, data: [], dataLabel: "SIMULATED_FIXTURE", coverage: { complete: true, fresh: true, scope: "fixtures only" } };
  }

  async getTransaction() {
    return { providerStatus: this.status, data: null, dataLabel: "SIMULATED_FIXTURE" };
  }

  async getAddressTransactions({ address }) {
    const normalized = normalizeAddress(this.chain, address).address;
    const transactions = fixtureGraphs[this.chain].transactions;
    const knownFixtureAddresses = new Set(transactions.flatMap((transaction) => [
      normalizeAddress(this.chain, transaction.fromAddress).address,
      normalizeAddress(this.chain, transaction.toAddress).address,
    ]));
    return {
      providerStatus: this.status,
      data: knownFixtureAddresses.has(normalized) ? transactions : [],
      dataLabel: "SIMULATED_FIXTURE",
      coverage: { complete: true, fresh: true, scope: "deterministic fixtures only" },
    };
  }
}
