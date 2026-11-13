export class BlockchainAdapter {
  constructor(chain) {
    this.chain = chain;
  }

  validateAddress() {
    throw new Error("validateAddress must be implemented by a blockchain adapter");
  }

  normalizeAddress() {
    throw new Error("normalizeAddress must be implemented by a blockchain adapter");
  }

  async getNativeBalance() {
    throw new Error("getNativeBalance must be implemented by a blockchain adapter");
  }

  async getTokenTransfers() {
    throw new Error("getTokenTransfers must be implemented by a blockchain adapter");
  }

  async getTransaction() {
    throw new Error("getTransaction must be implemented by a blockchain adapter");
  }

  async getAddressTransactions() {
    throw new Error("getAddressTransactions must be implemented by a blockchain adapter");
  }

  // Return normalized transaction rows with hash, fromAddress, toAddress, amount,
  // timestamp, and optional asset/value fields; the application validates each row.
}
