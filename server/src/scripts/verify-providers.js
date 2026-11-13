import { getBlockchainAdapter } from "../adapters/blockchain/registry.js";

const results = [];
const evmTargets = { ETHEREUM: "0x0000000000000000000000000000000000000000", BSC: "0x8894e0a0c962cb723c1976a4421c95949be2d4e3" };
const expectedChainIds = { ETHEREUM: "0x1", BSC: "0x38" };

function report(chain, check, status, detail = "") {
  results.push({ chain, check, status });
  process.stdout.write(`${chain.padEnd(9)} ${check.padEnd(20)} ${status}${detail ? ` — ${detail}` : ""}\n`);
}

for (const chain of ["TRON", "ETHEREUM", "BSC"]) {
  const adapter = getBlockchainAdapter(chain);
  if (!adapter || (adapter.status !== "LIVE" && chain !== "BSC")) {
    report(chain, "configuration", "FAIL", "Provider URL or required credential is missing");
    continue;
  }
  report(chain, "configuration", adapter.status === "LIVE" ? "PASS" : "FAIL", adapter.status === "LIVE" ? "Live provider settings detected; values redacted" : "BSC RPC URL is not configured");
  try {
    if (chain === "TRON") {
      const account = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
      const [balance, history] = await Promise.all([
        adapter.getNativeBalance({ address: account }),
        adapter.getAddressTransactions({ address: account, depth: 1 }),
      ]);
      report(chain, "TRON RPC", balance.providerStatus === "LIVE" ? "PASS" : "FAIL");
      report(chain, "TRON history", history.providerStatus === "LIVE" ? "PASS" : "FAIL", "Account and TRC-20 endpoints");
      const issuerStatus = await adapter.getIssuerFreezeStatus({ address: account });
      report(chain, "Issuer blocklist", issuerStatus.errors.length === 0 ? "PASS" : "FAIL", "Tether USDT read-only contract call");
      const addressRisk = await adapter.getAddressRiskSignals({ address: account });
      const riskStatus = !addressRisk.configured ? "UNCONFIGURED" : addressRisk.errors.length ? "FAIL" : "PASS";
      const riskDetail = !addressRisk.configured
        ? "Set TRONSCAN_API_KEY to enable the security-service query"
        : addressRisk.errors.length ? "Account-security request failed" : `${addressRisk.matches.length} risk flags returned`;
      report("TRONSCAN", "Account risk flags", riskStatus, riskDetail);
    } else {
      const actualChainId = await adapter.rpc("eth_chainId", []);
      const chainOk = actualChainId?.toLowerCase() === expectedChainIds[chain];
      report(chain, "JSON-RPC", chainOk ? "PASS" : "FAIL", chainOk ? `Chain ID ${actualChainId}` : `Unexpected chain ID ${String(actualChainId || "missing")}`);
      const balance = await adapter.getNativeBalance({ address: evmTargets[chain] });
      report(chain, "Native balance", balance.providerStatus === "LIVE" ? "PASS" : "FAIL");
      if (chain === "ETHEREUM") {
        const issuerStatus = await adapter.getIssuerFreezeStatus({ address: evmTargets[chain] });
        report(chain, "Issuer blocklist", issuerStatus.errors.length === 0 ? "PASS" : "FAIL", "Tether USDT and Circle USDC read-only contract calls");
        const history = await adapter.getAddressTransactions({ address: evmTargets[chain], depth: 1 });
        report(chain, "Indexed history", history.providerStatus === "LIVE" ? "PASS" : "FAIL", "Alchemy external/ERC-20 transfer method");
      } else {
        report(chain, "Issuer blocklist", "NOT APPLICABLE", "No native issuer token contract configured");
      }
    }
  } catch {
    report(chain, "connectivity", "FAIL", "Request failed; endpoint and key were not printed");
  }
  if (chain === "BSC") {
    try {
      const history = await adapter.getAddressTransactions({ address: evmTargets.BSC, depth: 1 });
      const rowCount = Array.isArray(history.data) ? history.data.length : 0;
      const nativeRows = history.coverage?.nativeRows || 0;
      const erc20Rows = history.coverage?.erc20Rows || 0;
      const historyPass = history.providerStatus === "LIVE" && nativeRows > 0 && erc20Rows > 0;
      report(chain, "Indexed history", historyPass ? "PASS" : "FAIL", `NodeReal native/ERC-20; ${nativeRows} native + ${erc20Rows} token rows (${rowCount} normalized)`);
    } catch {
      report(chain, "Indexed history", "FAIL", "NodeReal BSC request failed; endpoint and key were not printed");
    }
  }
}

const failed = results.some((row) => row.status === "FAIL");
const unsupported = results.some((row) => row.status === "UNSUPPORTED");
const unconfigured = results.some((row) => row.status === "UNCONFIGURED");
process.stdout.write(`\nProvider verification ${failed ? "FAILED" : unsupported || unconfigured ? "PARTIAL" : "PASSED"}.\n`);
if (failed) process.exitCode = 1;
