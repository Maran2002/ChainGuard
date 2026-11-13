import test from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV ||= "test";
process.env.JWT_ACCESS_SECRET ||= "test_access_secret_value_never_used_outside_test_123456";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret_value_never_used_outside_test_654321";
process.env.INTELLIGENCE_INGESTION_ENABLED = "true";
const { assertIntelligenceAdapter } = await import("../adapters/intelligence/adapter.js");
const { registerIntelligenceAdapter } = await import("../adapters/intelligence/registry.js");
const { fortaEthereumExploitAdapter, fortaEthereumPhishingAdapter, parseCsv } = await import("../adapters/intelligence/forta-ethereum-adapter.js");
const { prepareSourceRecords, runIngestion } = await import("../services/intelligence/ingestion-service.js");

const metadata = { id: "fixture-source", name: "Fixture Intelligence Source", attributionUrl: "https://example.test/source" };
const validRecord = {
  chain: "TRON",
  address: "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL",
  category: "SCAM",
  riskLevel: "HIGH",
  entityName: "Example label",
  sourceUrl: "https://example.test/record/1",
  confidence: 0.9,
  tags: ["fixture"],
};

test("registered adapter contract validates the required interface and safe metadata", () => {
  const adapter = {
    getSourceMetadata: () => metadata,
    fetchRecords: async () => [],
    normalizeRecord: (record) => record,
  };
  assert.equal(assertIntelligenceAdapter(adapter).metadata.id, metadata.id);
  assert.throws(() => assertIntelligenceAdapter({ ...adapter, getSourceMetadata: () => ({ ...metadata, attributionUrl: "javascript:alert(1)" }) }));
  assert.throws(() => assertIntelligenceAdapter({ getSourceMetadata: () => metadata }));
});

test("Forta CSV parser handles quoted delimiters and rejects malformed quoting", () => {
  assert.deepEqual(parseCsv('address,label\r\n0xabc,"label, with comma"\r\n'), [{ address: "0xabc", label: "label, with comma" }]);
  assert.throws(() => parseCsv('address,label\n0xabc,"unfinished'), { code: "SOURCE_INVALID_CSV" });
});

test("Forta source adapters preserve attribution while classifying phishing and exploits as unconfirmed evidence", () => {
  const phishing = fortaEthereumPhishingAdapter.normalizeRecord({ address: "0x000000000532b45f47779fce440748893b257865", etherscan_tag: "Fake_Phishing3901", etherscan_labels: "phish-hack", is_contract: "False" });
  const exploit = fortaEthereumExploitAdapter.normalizeRecord({ contract_address: "0x04ae3226c80e8c04d35e6e56089345bdd06da6de", contract_tag: "Multichain Exploiter", contract_creator_etherscan_label: "exploit", source: "Luabase ethereum.tags table" });
  assert.equal(phishing.chain, "ETHEREUM");
  assert.equal(phishing.category, "SCAM");
  assert.equal(phishing.confirmed, false);
  assert.match(phishing.sourceUrl, /forta-network\/labelled-datasets/);
  assert.equal(exploit.category, "HACK");
  assert.equal(exploit.confirmed, false);
  assert.equal(fortaEthereumPhishingAdapter.getSourceMetadata().termsUrl, "https://github.com/forta-network/labelled-datasets/blob/main/LICENSE");
});

test("ingestion normalization validates addresses, adds registered source metadata, and deduplicates records", async () => {
  const adapter = { normalizeRecord: (record) => record };
  const prepared = await prepareSourceRecords(adapter, metadata, [validRecord, validRecord, { ...validRecord, address: "not-an-address" }]);
  assert.equal(prepared.fetched, 3);
  assert.equal(prepared.records.length, 1);
  assert.equal(prepared.skipped, 1);
  assert.equal(prepared.failed, 1);
  assert.equal(prepared.records[0].address, "418840e6c55b9ada326d211d818c34a994aeced808");
  assert.equal(prepared.records[0].sourceId, metadata.id);
  assert.equal(prepared.records[0].sourceName, metadata.name);
});

test("ingestion rejects unsupported response sizes and user-selected source IDs", async () => {
  await assert.rejects(() => prepareSourceRecords({ normalizeRecord: (record) => record }, metadata, Array(501).fill(validRecord)), { code: "SOURCE_RECORD_LIMIT" });
  await assert.rejects(() => runIngestion("missing-source", { dryRun: true }), { code: "SOURCE_NOT_FOUND" });
});

test("registered source can run a deterministic dry run without database writes", async () => {
  registerIntelligenceAdapter({
    getSourceMetadata: () => ({ ...metadata, id: "dry-run-source" }),
    fetchRecords: async () => [validRecord],
    normalizeRecord: (record) => record,
  });
  const result = await runIngestion("dry-run-source", { dryRun: true });
  assert.equal(result.status, "DRY_RUN");
  assert.equal(result.counts.fetched, 1);
  assert.equal(result.counts.created, 0);
  assert.equal(result.counts.failed, 0);
  assert.equal("records" in result.counts, false);
});

test("ingestion retries transient source failures before completing", async () => {
  let attempts = 0;
  registerIntelligenceAdapter({
    getSourceMetadata: () => ({ ...metadata, id: "retry-source" }),
    fetchRecords: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("sensitive provider detail must not be returned");
      return [validRecord];
    },
    normalizeRecord: (record) => record,
  });
  const result = await runIngestion("retry-source", { dryRun: true });
  assert.equal(attempts, 3);
  assert.equal(result.status, "DRY_RUN");
});
