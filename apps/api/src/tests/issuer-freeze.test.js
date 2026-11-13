import test from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV ||= "test";
process.env.JWT_ACCESS_SECRET ||= "test_access_secret_value_never_used_outside_test_123456";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret_value_never_used_outside_test_654321";

const { AlchemyEvmAdapter } = await import("../adapters/blockchain/alchemy-evm-adapter.js");
const { chains } = await import("../config/chains.js");

test("issuer contract registry contains only issuer-confirmed network deployments", () => {
  assert.equal(chains.ETHEREUM.tokenContracts.USDT, "0xdac17f958d2ee523a2206206994597c13d831ec7");
  assert.equal(chains.ETHEREUM.tokenContracts.USDC, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  assert.equal(chains.TRON.tokenContracts.USDT, "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
  assert.deepEqual(chains.BSC.tokenContracts, {});
});

test("Ethereum checks both issuer contracts and returns only active blocklist matches", async () => {
  const adapter = Object.create(AlchemyEvmAdapter.prototype);
  adapter.chain = "ETHEREUM";
  adapter.status = "LIVE";
  adapter.normalizeAddress = (address) => address.toLowerCase();
  const calls = [];
  adapter.rpc = async (method, [call]) => {
    calls.push(call);
    return call.to === chains.ETHEREUM.tokenContracts.USDT ? `0x${"0".repeat(63)}1` : `0x${"0".repeat(64)}`;
  };
  const status = await adapter.getIssuerFreezeStatus({ address: "0x1111111111111111111111111111111111111111" });
  assert.equal(calls.length, 2);
  assert.equal(status.matches.length, 1);
  assert.equal(status.matches[0].sourceId, "issuer-freeze-usdt-ethereum");
  assert.deepEqual(status.errors, []);
});

test("BSC does not claim issuer-freeze coverage without an official supported token contract", async () => {
  const adapter = Object.create(AlchemyEvmAdapter.prototype);
  adapter.chain = "BSC";
  adapter.status = "LIVE";
  const status = await adapter.getIssuerFreezeStatus({ address: "0x1111111111111111111111111111111111111111" });
  assert.deepEqual(status.matches, []);
  assert.deepEqual(status.errors, []);
});
