import test from "node:test";
import assert from "node:assert/strict";
import { MockBlockchainAdapter } from "../adapters/blockchain/mock-adapter.js";
import { UnavailableBlockchainAdapter } from "../adapters/blockchain/unavailable-adapter.js";

test("mock provider labels deterministic fixture-only data", async () => {
  const adapter = new MockBlockchainAdapter("TRON");
  const first = await adapter.getAddressTransactions({ address: "41" + "a".repeat(40) });
  const second = await adapter.getAddressTransactions({ address: "41" + "a".repeat(40) });
  assert.equal(adapter.status, "MOCK");
  assert.equal(first.dataLabel, "SIMULATED_FIXTURE");
  assert.deepEqual(first, second);
  assert.equal(first.coverage.scope, "deterministic fixtures only");
});

test("unconfigured provider reports unavailable with incomplete coverage", async () => {
  const result = await new UnavailableBlockchainAdapter("ETHEREUM").getAddressTransactions({ address: "0x0" });
  assert.equal(result.providerStatus, "UNAVAILABLE");
  assert.equal(result.coverage.complete, false);
});
