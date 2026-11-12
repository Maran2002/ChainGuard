import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, registerSchema } from "../validators/auth.js";

test("registration accepts valid account fields and normalizes surrounding whitespace", () => {
  const account = registerSchema.parse({ name: "  Alex Morgan  ", email: "alex@example.com", password: "a-long-passphrase-42" });
  assert.equal(account.name, "Alex Morgan");
  assert.equal(account.email, "alex@example.com");
  assert.equal(account.password, "a-long-passphrase-42");
});

test("registration rejects short passwords and client-selected roles", () => {
  assert.equal(registerSchema.safeParse({ name: "Alex", email: "alex@example.com", password: "short" }).success, false);
  assert.equal(registerSchema.safeParse({ name: "Alex", email: "alex@example.com", password: "a-long-passphrase-42", role: "ADMIN" }).success, false);
});

test("login requires a valid email and non-empty password", () => {
  assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "alex@example.com", password: "" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "alex@example.com", password: "secret" }).success, true);
});
