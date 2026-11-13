import test from "node:test";
import assert from "node:assert/strict";
import { createScreeningSchema, screeningListSchema } from "../validators/screening.js";

test("screening input defaults to one hop and caps investigation depth at two", () => {
  const input = createScreeningSchema.parse({ chain: "TRON", address: " TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL " });
  assert.equal(input.depth, 1);
  assert.equal(createScreeningSchema.safeParse({ chain: "TRON", address: "T", depth: 3 }).success, false);
});

test("screening input rejects client-controlled fields and malformed hashes", () => {
  assert.equal(createScreeningSchema.safeParse({ chain: "TRON", address: "T", userId: "someone-else" }).success, false);
  assert.equal(createScreeningSchema.safeParse({ chain: "ETHEREUM", address: "0x", transactionHash: "not-a-hash" }).success, false);
});

test("history filters enforce pagination and query limits", () => {
  assert.equal(screeningListSchema.parse({ page: "2", limit: "50" }).page, 2);
  assert.equal(screeningListSchema.safeParse({ page: "0" }).success, false);
  assert.equal(screeningListSchema.safeParse({ limit: "101" }).success, false);
});
