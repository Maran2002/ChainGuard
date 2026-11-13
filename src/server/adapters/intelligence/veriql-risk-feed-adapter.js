const sourceUrl = "https://veriql.app/drain-watch/blocklist.json";
const attributionUrl = "https://veriql.app/drain-watch";
const termsUrl = "https://veriql.app/drain-watch";
const maxResponseBytes = 8 * 1024 * 1024;
const maxRecords = 5000;

async function fetchFeed(signal) {
  const response = await fetch(sourceUrl, {
    headers: { accept: "application/json", "user-agent": "ChainGuard/1.0" },
    redirect: "error",
    signal,
  });
  if (!response.ok) throw Object.assign(new Error("Threat feed fetch failed"), { code: "SOURCE_FETCH_FAILED" });
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > maxResponseBytes) throw Object.assign(new Error("Threat feed exceeds size limit"), { code: "SOURCE_RESPONSE_TOO_LARGE" });
  const reader = response.body?.getReader();
  if (!reader) throw Object.assign(new Error("Threat feed body is missing"), { code: "SOURCE_INVALID_RESPONSE" });
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxResponseBytes) {
      await reader.cancel();
      throw Object.assign(new Error("Threat feed exceeds size limit"), { code: "SOURCE_RESPONSE_TOO_LARGE" });
    }
    chunks.push(Buffer.from(value));
  }
  let feed;
  try { feed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Threat feed JSON is invalid"), { code: "SOURCE_INVALID_RESPONSE" }); }
  if (!Array.isArray(feed?.entries) || feed.entries.length > maxRecords || !feed?.meta?.generatedAt) {
    throw Object.assign(new Error("Threat feed schema is invalid or exceeds the record limit"), { code: "SOURCE_INVALID_RESPONSE" });
  }
  return { entries: feed.entries, generatedAt: feed.meta.generatedAt };
}

function isRiskEntry(entry) {
  return ["phishing", "drainer", "theft"].includes(String(entry?.category || "").toLowerCase());
}

function hasAddressEvidence(entry) {
  return typeof entry?.address === "string" && Array.isArray(entry?.sources) && entry.sources.length > 0;
}

function sourceEvidence(entry) {
  return entry.sources.find((source) => typeof source?.url === "string" && /^https?:\/\//i.test(source.url)) || null;
}

function normalize(entry, chain) {
  const category = String(entry.category).toLowerCase();
  const source = sourceEvidence(entry);
  const isEvmScope = chain === "BSC";
  return {
    chain,
    address: entry.address,
    category: category === "theft" ? "HACK" : "SCAM",
    riskLevel: "HIGH",
    entityName: category === "theft" ? "Reported theft address" : `Reported ${category} address`,
    sourceUrl: source?.url || sourceUrl,
    description: isEvmScope
      ? `Veriql labels this address as ${category} in its EVM-wide feed. The upstream row does not identify a specific EVM network; the BSC match is an address-level indicator, not proof that a contract is deployed or active on BSC. Source license: ${source?.license || "see per-entry source"}.`
      : `Veriql labels this TRON address as ${category}. This is reported intelligence, not an adjudication. Source license: ${source?.license || "see per-entry source"}.`,
    confidence: entry.confidence === "reported" ? 0.7 : 0.6,
    confirmed: false,
    effectiveAt: null,
    lastSeenAt: null,
    tags: ["veriql", "manual-snapshot", category, ...(isEvmScope ? ["evm-scope-unspecified"] : ["tron"])],
    rawReference: `${source?.source || "source unspecified"}${source?.license ? `; ${source.license}` : ""}`,
  };
}

function makeAdapter({ id, name, chain, upstreamChain }) {
  return Object.freeze({
    getSourceMetadata() {
      return {
        id,
        name,
        chains: [chain],
        attributionUrl,
        termsUrl,
        updateCadence: "Manual refresh only; 72-hour freshness target",
        freshnessMaxAgeHours: 72,
        freshnessUsesSourceTimestamp: true,
        maxRecordsPerRun: maxRecords,
        snapshot: true,
      };
    },
    async fetchRecords({ signal }) {
      const feed = await fetchFeed(signal);
      return {
        records: feed.entries.filter((entry) => entry?.chain === upstreamChain && isRiskEntry(entry) && hasAddressEvidence(entry)),
        sourceGeneratedAt: feed.generatedAt,
      };
    },
    normalizeRecord(entry) { return normalize(entry, chain); },
  });
}

export const veriqlTronRiskAdapter = makeAdapter({
  id: "veriql-tron-risk",
  name: "Veriql TRON scam and theft indicators",
  chain: "TRON",
  upstreamChain: "tron",
});

export const veriqlBscRiskAdapter = makeAdapter({
  id: "veriql-bsc-evm-risk",
  name: "Veriql EVM-wide scam and theft indicators (BSC address scope)",
  chain: "BSC",
  upstreamChain: "evm",
});
