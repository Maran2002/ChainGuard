const repositoryUrl = "https://github.com/forta-network/labelled-datasets";
const licenseUrl = `${repositoryUrl}/blob/main/LICENSE`;
const maxCsvBytes = 12 * 1024 * 1024;
const phishingUrl = "https://raw.githubusercontent.com/forta-network/labelled-datasets/main/labels/1/phishing_scams.csv";
const exploitUrl = "https://raw.githubusercontent.com/forta-network/labelled-datasets/main/labels/1/malicious_smart_contracts.csv";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw Object.assign(new Error("Forta CSV contains an unclosed quoted field"), { code: "SOURCE_INVALID_CSV" });
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const [header, ...data] = rows;
  if (!header?.length || header.length > 64) throw Object.assign(new Error("Forta CSV header is invalid"), { code: "SOURCE_INVALID_CSV" });
  return data.filter((record) => record.some((value) => value !== "")).map((record) => Object.fromEntries(header.map((name, index) => [name.trim(), record[index] ?? ""])));
}

async function fetchCsv(url, signal) {
  const response = await fetch(url, { headers: { accept: "text/csv, text/plain;q=0.9", "user-agent": "ChainGuard/1.0" }, redirect: "error", signal });
  if (!response.ok) throw Object.assign(new Error("Forta dataset fetch failed"), { code: "SOURCE_FETCH_FAILED" });
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > maxCsvBytes) throw Object.assign(new Error("Forta dataset exceeds its size limit"), { code: "SOURCE_RESPONSE_TOO_LARGE" });
  const reader = response.body?.getReader();
  if (!reader) throw Object.assign(new Error("Forta dataset body is missing"), { code: "SOURCE_INVALID_RESPONSE" });
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxCsvBytes) {
      await reader.cancel();
      throw Object.assign(new Error("Forta dataset exceeds its size limit"), { code: "SOURCE_RESPONSE_TOO_LARGE" });
    }
    chunks.push(Buffer.from(value));
  }
  const records = parseCsv(Buffer.concat(chunks).toString("utf8"));
  if (!records.length) throw Object.assign(new Error("Forta dataset was empty"), { code: "SOURCE_INVALID_RESPONSE" });
  return records;
}

function metadata(id, name, attributionUrl) {
  return {
    id,
    name,
    chains: ["ETHEREUM"],
    attributionUrl,
    termsUrl: licenseUrl,
    updateCadence: "Manual refresh only; 7-day freshness target",
    freshnessMaxAgeHours: 168,
    maxRecordsPerRun: 10000,
    snapshot: true,
  };
}

export const fortaEthereumPhishingAdapter = Object.freeze({
  getSourceMetadata() { return metadata("forta-ethereum-phishing", "Forta Ethereum phishing labels", phishingUrl); },
  async fetchRecords({ signal }) { return fetchCsv(phishingUrl, signal); },
  normalizeRecord(row) {
    return {
      chain: "ETHEREUM",
      address: row.address,
      category: "SCAM",
      riskLevel: "HIGH",
      entityName: row.etherscan_tag || "Phishing-labeled address",
      sourceUrl: phishingUrl,
      description: `Forta dataset label: ${row.etherscan_labels || "phishing"}${row.is_contract ? "; contract address" : "; wallet address"}. This upstream label is not an adjudication.`,
      confidence: 0.75,
      confirmed: false,
      tags: ["forta", "ethereum", "phishing", row.is_contract === "True" ? "contract" : "wallet"],
      rawReference: row.etherscan_labels || "phishing",
    };
  },
});

export const fortaEthereumExploitAdapter = Object.freeze({
  getSourceMetadata() { return metadata("forta-ethereum-exploits", "Forta Ethereum exploit and heist labels", exploitUrl); },
  async fetchRecords({ signal }) { return fetchCsv(exploitUrl, signal); },
  normalizeRecord(row) {
    const labels = [row.contract_tag, row.contract_creator_tag, row.contract_creator_etherscan_label].filter(Boolean).join("; ");
    const category = /phish/i.test(labels) ? "SCAM" : "HACK";
    return {
      chain: "ETHEREUM",
      address: row.contract_address,
      category,
      riskLevel: "HIGH",
      entityName: row.contract_tag || row.contract_creator_tag || "Exploit-labeled contract",
      sourceUrl: exploitUrl,
      description: `Forta malicious-contract dataset label${labels ? `: ${labels}` : " (exploit/heist source file)"}. This upstream label is not an adjudication.`,
      confidence: 0.75,
      confirmed: false,
      tags: ["forta", "ethereum", category === "SCAM" ? "phishing" : "exploit"],
      rawReference: labels || row.source || "exploit/heist",
    };
  },
});
