import test from "node:test";
import assert from "node:assert/strict";
import { calculateRisk } from "../services/risk/risk-engine.js";

const baseInput = { chain: "ETHEREUM", address: "0xabc", coverage: { complete: true, fresh: true, sources: ["fixture"] }, providerStatus: "MOCK" };

test("complete no-match coverage returns LOW with careful wording", () => {
  const result = calculateRisk(baseInput);
  assert.equal(result.verdict, "LOW");
  assert.equal(result.riskScore, 0);
  assert.equal(result.noMatchesMessage, "No known matches found in the configured sources.");
});

test("incomplete coverage without evidence returns UNKNOWN instead of LOW", () => {
  const result = calculateRisk({ ...baseInput, coverage: { complete: false, fresh: false } });
  assert.equal(result.verdict, "UNKNOWN");
  assert.equal(result.riskScore, null);
  assert.match(result.recommendedAction, /Configure providers/);
});

test("confirmed sanctions and issuer freeze matches return CRITICAL", () => {
  const sanctions = calculateRisk({ ...baseInput, directMatches: [{ category: "SANCTIONED", confirmed: true, confidence: 1, sourceId: "fixture-1" }] });
  const freeze = calculateRisk({ ...baseInput, issuerFreezeMatch: { confirmed: true, confidence: 1, sourceId: "fixture-2" } });
  assert.equal(sanctions.verdict, "CRITICAL");
  assert.equal(freeze.verdict, "CRITICAL");
});

test("behavior indicators are labeled as heuristic evidence", () => {
  const input = { ...baseInput, behaviorFindings: [{ label: "Rapid transfers", weight: 20, confidence: 0.8, explanation: "Frequent outward transfers." }] };
  const result = calculateRisk(input);
  assert.equal(result.verdict, "LOW");
  assert.match(result.riskFactors[0].explanation, /Frequent outward transfers/);
});

test("risk output is deterministic for the same input", () => {
  const input = { ...baseInput, exposureFindings: [{ riskLevel: "HIGH", distance: 2, confidence: 0.8, sourceId: "exposure-1" }] };
  assert.deepEqual(calculateRisk(input), calculateRisk(input));
});
