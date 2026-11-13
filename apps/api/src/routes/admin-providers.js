import { Router } from "express";
import { env } from "../config/env.js";
import { authenticate, requireRole } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { getBlockchainProviderStatuses } from "../adapters/blockchain/registry.js";

export const adminProvidersRouter = Router();
adminProvidersRouter.use(requireDatabase, authenticate, requireRole("ADMIN"));

adminProvidersRouter.get("/", (req, res) => {
  const statuses = getBlockchainProviderStatuses();
  const providers = [
    { chain: "TRON", provider: "TronGrid RPC + TRONSCAN security checks", setupUrl: "https://www.trongrid.io/" },
    { chain: "ETHEREUM", provider: "Alchemy", setupUrl: "https://www.alchemy.com/docs/create-an-api-key" },
    { chain: "BSC", provider: "Alchemy RPC + NodeReal indexed history", setupUrl: "https://docs.nodereal.io/reference/getting-started-with-your-api" },
  ].map((provider) => {
    const endpoint = env[`${provider.chain}_RPC_URL`];
    let endpointValid = false;
    try {
      const url = new URL(endpoint);
      endpointValid = url.protocol === "https:" && !url.username && !url.password;
    } catch { /* Missing or malformed URLs are reported without their contents. */ }
    return {
      ...provider,
      endpointVariable: `${provider.chain}_RPC_URL`, keyVariable: `${provider.chain}_API_KEY`,
      endpointPresent: Boolean(endpoint), endpointValid,
      separateKeyPresent: Boolean(env[`${provider.chain}_API_KEY`]),
      indexedHistoryProvider: provider.chain === "BSC" ? "NodeReal" : null,
      indexedHistoryCredentialVariable: provider.chain === "BSC" ? "NODEREAL_API_KEY" : null,
      indexedHistoryConfigured: provider.chain === "BSC" ? true : null,
      indexedHistoryUsesSharedKey: provider.chain === "BSC" ? !env.NODEREAL_API_KEY : null,
      addressRiskProvider: provider.chain === "TRON" ? "TRONSCAN Account Security API" : null,
      addressRiskCredentialVariable: provider.chain === "TRON" ? "TRONSCAN_API_KEY" : null,
      addressRiskConfigured: provider.chain === "TRON" ? Boolean(env.TRONSCAN_API_KEY) : null,
      adapterStatus: statuses[provider.chain], liveAdapterImplemented: true,
      connectivity: "NOT_CHECKED",
    };
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: { mode: env.BLOCKCHAIN_PROVIDER_MODE, providers }, requestId: req.id });
});
