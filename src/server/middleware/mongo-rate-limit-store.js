import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";

const collectionName = "rate_limit_counters";

export class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = `chainguard:${prefix}:`;
    this.windowMs = 15 * 60 * 1000;
    this.indexPromise = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  getCollection() {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw new Error("Shared rate-limit storage is unavailable");
    }
    return mongoose.connection.db.collection(collectionName);
  }

  async ensureIndexes() {
    if (!this.indexPromise) {
      this.indexPromise = Promise.all([
        this.getCollection().createIndex({ key: 1 }, { unique: true }),
        this.getCollection().createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
      ]).catch((error) => {
        this.indexPromise = null;
        throw error;
      });
    }
    await this.indexPromise;
  }

  storageKey(key) {
    const digest = createHash("sha256").update(String(key)).digest("hex");
    return `${this.prefix}${digest}`;
  }

  async increment(key) {
    await this.ensureIndexes();
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const record = await this.getCollection().findOneAndUpdate(
      { key: this.storageKey(key) },
      [{ $set: {
        totalHits: {
          $cond: [
            { $gt: ["$resetAt", now] },
            { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
            1,
          ],
        },
        resetAt: { $cond: [{ $gt: ["$resetAt", now] }, "$resetAt", resetAt] },
      } }],
      { upsert: true, returnDocument: "after" },
    );
    return { totalHits: record.totalHits, resetTime: record.resetAt };
  }

  async decrement(key) {
    await this.ensureIndexes();
    await this.getCollection().updateOne(
      { key: this.storageKey(key), totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } },
    );
  }

  async resetKey(key) {
    await this.ensureIndexes();
    await this.getCollection().deleteOne({ key: this.storageKey(key) });
  }

  async get(key) {
    await this.ensureIndexes();
    const record = await this.getCollection().findOne({ key: this.storageKey(key) });
    if (!record || record.resetAt <= new Date()) return undefined;
    return { totalHits: record.totalHits, resetTime: record.resetAt };
  }
}

export function productionRateLimitStore(prefix) {
  return env.NODE_ENV === "production" ? new MongoRateLimitStore(prefix) : undefined;
}
