import test from "node:test";
import assert from "node:assert/strict";
import { isValidAddress, normalizeAddress } from "../config/chains.js";

test("TRON Base58Check addresses validate and normalize to prefixed hex", () => {
  const result = normalizeAddress("TRON", "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL");
  assert.equal(result.chain, "TRON");
  assert.equal(result.address, "418840e6c55b9ada326d211d818c34a994aeced808");
});

test("TRON checksum errors and unsupported chains are rejected", () => {
  assert.equal(isValidAddress("TRON", "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeM"), false);
  assert.equal(isValidAddress("POLYGON", `0x${"0".repeat(40)}`), false);
});

test("EVM addresses are accepted with mixed case and normalized for lookup", () => {
  const result = normalizeAddress("ETHEREUM", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  assert.equal(result.address, "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed");
  assert.equal(isValidAddress("BSC", `0x${"a".repeat(40)}`), true);
});
