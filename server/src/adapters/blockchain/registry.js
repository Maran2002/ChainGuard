import { env } from "../../config/env.js";
import { chains } from "../../config/chains.js";
import { MockBlockchainAdapter } from "./mock-adapter.js";
import { UnavailableBlockchainAdapter } from "./unavailable-adapter.js";
import { AlchemyEvmAdapter } from "./alchemy-evm-adapter.js";
import { TronGridAdapter } from "./trongrid-adapter.js";

const adapters = Object.fromEntries(Object.keys(chains).map((chain) => [
  chain,
  env.BLOCKCHAIN_PROVIDER_MODE === "mock"
    ? new MockBlockchainAdapter(chain)
    : env.BLOCKCHAIN_PROVIDER_MODE === "live"
      ? chain === "TRON" ? new TronGridAdapter() : new AlchemyEvmAdapter(chain)
      : new UnavailableBlockchainAdapter(chain),
]));

export function getBlockchainAdapter(chain) {
  return adapters[String(chain || "").toUpperCase()] || null;
}

export function getBlockchainProviderStatuses() {
  return Object.fromEntries(Object.entries(adapters).map(([chain, adapter]) => [chain, adapter.status]));
}
