import { assertIntelligenceAdapter } from "./adapter.js";
import { ofacSdnDigitalCurrencyAdapter } from "./ofac-sdn-adapter.js";
import { fortaEthereumExploitAdapter, fortaEthereumPhishingAdapter } from "./forta-ethereum-adapter.js";
import { veriqlBscRiskAdapter, veriqlTronRiskAdapter } from "./veriql-risk-feed-adapter.js";

const adapters = new Map();

registerIntelligenceAdapter(ofacSdnDigitalCurrencyAdapter);
registerIntelligenceAdapter(fortaEthereumPhishingAdapter);
registerIntelligenceAdapter(fortaEthereumExploitAdapter);
registerIntelligenceAdapter(veriqlTronRiskAdapter);
registerIntelligenceAdapter(veriqlBscRiskAdapter);

export function registerIntelligenceAdapter(adapter) {
  const registered = assertIntelligenceAdapter(adapter);
  if (adapters.has(registered.metadata.id)) throw new Error(`Intelligence source already registered: ${registered.metadata.id}`);
  adapters.set(registered.metadata.id, registered);
  return registered.metadata;
}

export function getIntelligenceAdapter(sourceId) {
  return adapters.get(sourceId) || null;
}

export function listIntelligenceSources() {
  return [...adapters.values()].map(({ metadata }) => metadata);
}
