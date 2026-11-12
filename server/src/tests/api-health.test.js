import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV ||= "test";
process.env.JWT_ACCESS_SECRET ||= "test_access_secret_value_never_used_outside_test_123456";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret_value_never_used_outside_test_654321";
process.env.LOG_LEVEL ||= "silent";

const { app } = await import("../app.js");

test("process health includes a request ID and the standard success envelope", async () => {
  const response = await request(app).get("/health").expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.requestId, response.headers["x-request-id"]);
});

test("database readiness fails closed while MongoDB is disconnected", async () => {
  const response = await request(app).get("/health/ready").expect(503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "NOT_READY");
  assert.equal(response.body.data.database, "disconnected");
});

test("mutating requests from unconfigured origins are rejected", async () => {
  const response = await request(app).post("/api/v1/auth/logout").set("Origin", "https://attacker.example").expect(403);
  assert.equal(response.body.error.code, "ORIGIN_NOT_ALLOWED");
  assert.ok(response.body.requestId);
});
