import test from "node:test";
import assert from "node:assert/strict";
import { intelligenceListSchema } from "../validators/intelligence.js";

test("directory query applies bounded pagination and supported sorting defaults", () => {
  const query = intelligenceListSchema.parse({ page: "2", limit: "50", sort: "confidence", chain: "TRON" });
  assert.deepEqual({ page: query.page, limit: query.limit, sort: query.sort, chain: query.chain }, {
    page: 2,
    limit: 50,
    sort: "confidence",
    chain: "TRON",
  });
  assert.equal(intelligenceListSchema.parse({}).limit, 20);
  assert.equal(intelligenceListSchema.safeParse({ page: "0" }).success, false);
  assert.equal(intelligenceListSchema.safeParse({ limit: "101" }).success, false);
});

test("directory query rejects unsupported filters and client-controlled fields", () => {
  assert.equal(intelligenceListSchema.safeParse({ chain: "POLYGON" }).success, false);
  assert.equal(intelligenceListSchema.safeParse({ sort: "random" }).success, false);
  assert.equal(intelligenceListSchema.safeParse({ isActive: "false" }).success, false);
});

test("directory query rejects incident-date filters because incident dates are not provided", () => {
  assert.equal(intelligenceListSchema.safeParse({ from: "2026-11-03T00:00:00.000Z" }).success, false);
  assert.equal(intelligenceListSchema.safeParse({ to: "2026-11-04T23:59:59.999Z" }).success, false);
});
