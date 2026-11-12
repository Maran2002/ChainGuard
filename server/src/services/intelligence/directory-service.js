import mongoose from "mongoose";
import { normalizeAddress } from "../../config/chains.js";
import { IntelligenceRecord } from "../../models/intelligence-record.js";
import { httpError } from "../../utils/http-error.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortFor(sort) {
  if (sort === "oldest") return { ingestedAt: 1, _id: 1 };
  if (sort === "confidence") return { confidence: -1, ingestedAt: -1, _id: -1 };
  return { ingestedAt: -1, _id: -1 };
}

function selectedFields() {
  return "address chain category riskLevel entityName sourceId sourceName sourceUrl description confidence effectiveAt lastSeenAt ingestedAt rawReference tags isActive confirmed";
}

export async function listIntelligence(query) {
  const filter = { isActive: true };
  if (query.chain) filter.chain = query.chain;
  if (query.category) filter.category = query.category;
  if (query.riskLevel) filter.riskLevel = query.riskLevel;
  if (query.from || query.to) {
    filter.ingestedAt = {};
    if (query.from) filter.ingestedAt.$gte = new Date(query.from);
    if (query.to) filter.ingestedAt.$lte = new Date(query.to);
  }
  if (query.source) {
    const source = new RegExp(escapeRegex(query.source), "i");
    filter.$or = [{ sourceId: source }, { sourceName: source }];
  }
  if (query.q) {
    const term = new RegExp(escapeRegex(query.q), "i");
    filter.$and = [...(filter.$and || []), { $or: [{ address: term }, { entityName: term }, { category: term }, { sourceId: term }, { sourceName: term }, { tags: term }] }];
  }
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    IntelligenceRecord.find(filter).select(selectedFields()).sort(sortFor(query.sort)).skip(skip).limit(query.limit).lean(),
    IntelligenceRecord.countDocuments(filter),
  ]);
  return { items, meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
}

export async function getIntelligenceRecord(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "INTELLIGENCE_NOT_FOUND", "Intelligence record was not found");
  const record = await IntelligenceRecord.findOne({ _id: id, isActive: true }).select(selectedFields()).lean();
  if (!record) throw httpError(404, "INTELLIGENCE_NOT_FOUND", "Intelligence record was not found");
  return record;
}

export async function findByAddress(chain, address) {
  const normalized = normalizeAddress(chain, address);
  const records = await IntelligenceRecord.find({ chain: normalized.chain, address: normalized.address, isActive: true }).select(selectedFields()).sort({ ingestedAt: -1 }).limit(50).lean();
  return { chain: normalized.chain, address: normalized.address, records };
}
