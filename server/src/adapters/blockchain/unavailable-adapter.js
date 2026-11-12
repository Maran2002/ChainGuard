import { BlockchainAdapter } from "./adapter.js";
import { isValidAddress, normalizeAddress } from "../../config/chains.js";

export class UnavailableBlockchainAdapter extends BlockchainAdapter {
  constructor(chain) {
    super(chain);
    this.status = "UNAVAILABLE";
  }

  validateAddress(address) {
    return isValidAddress(this.chain, address);
  }

  normalizeAddress(address) {
    return normalizeAddress(this.chain, address).address;
  }

  async getNativeBalance() { return { providerStatus: this.status, data: null }; }
  async getTokenTransfers() { return { providerStatus: this.status, data: null, coverage: { complete: false, fresh: false } }; }
  async getTransaction() { return { providerStatus: this.status, data: null }; }
  async getAddressTransactions() { return { providerStatus: this.status, data: null, coverage: { complete: false, fresh: false } }; }
}
