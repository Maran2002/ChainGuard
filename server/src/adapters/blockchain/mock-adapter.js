import { BlockchainAdapter } from "./adapter.js";
import { isValidAddress, normalizeAddress } from "../../config/chains.js";

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

  async getAddressTransactions() {
    return { providerStatus: this.status, data: [], dataLabel: "SIMULATED_FIXTURE", coverage: { complete: true, fresh: true, scope: "fixtures only" } };
  }
}
