const sourceUrl = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML";
const listUrl = "https://sanctionslist.ofac.treas.gov/Home/SdnList";
const publishedFileHost = "wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com";
const maxXmlBytes = 48 * 1024 * 1024;
const chainByTicker = Object.freeze({
  TRX: "TRON",
  TRON: "TRON",
  ETH: "ETHEREUM",
  ETHEREUM: "ETHEREUM",
  BSC: "BSC",
});

function decodeXmlText(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    if (code[0] === "#") {
      const hex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[code.toLowerCase()];
  }).trim();
}

function tagValue(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i").exec(xml);
  return match ? decodeXmlText(match[1].replace(/<[^>]*>/g, "")) : "";
}

export function parseOfacSdnXml(xml, observedAt = new Date()) {
  if (typeof xml !== "string" || xml.length === 0 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<sdnList(?:\s|>)/i.test(xml)) {
    throw Object.assign(new Error("OFAC SDN XML is invalid"), { code: "SOURCE_INVALID_XML" });
  }
  const records = new Map();
  const entryPattern = /<sdnEntry\b[^>]*>([\s\S]*?)<\/sdnEntry\s*>/gi;
  let entryMatch;
  let entryCount = 0;
  while ((entryMatch = entryPattern.exec(xml))) {
    entryCount += 1;
    const entryXml = entryMatch[1];
    const uid = tagValue(entryXml, "uid");
    const entityName = [tagValue(entryXml, "firstName"), tagValue(entryXml, "lastName")].filter(Boolean).join(" ").slice(0, 200);
    const programList = /<programList\b[^>]*>([\s\S]*?)<\/programList\s*>/i.exec(entryXml)?.[1] || "";
    const programs = [...programList.matchAll(/<program\b[^>]*>([\s\S]*?)<\/program\s*>/gi)]
      .map((match) => decodeXmlText(match[1])).filter(Boolean).slice(0, 30);
    const idList = /<idList\b[^>]*>([\s\S]*?)<\/idList\s*>/i.exec(entryXml)?.[1] || "";
    for (const idMatch of idList.matchAll(/<id\b[^>]*>([\s\S]*?)<\/id\s*>/gi)) {
      const identifier = idMatch[1];
      const idType = tagValue(identifier, "idType");
      const idNumber = tagValue(identifier, "idNumber");
      const ticker = /^Digital Currency Address\s*-\s*([A-Z0-9]{2,24})$/i.exec(idType)?.[1]?.toUpperCase();
      const chain = ticker ? chainByTicker[ticker] : null;
      if (!chain || !idNumber) continue;
      const record = {
        chain,
        address: idNumber,
        category: "SANCTIONED",
        riskLevel: "CRITICAL",
        entityName: entityName || null,
        description: `OFAC SDN digital currency address (${ticker}); source entry UID ${uid || "not provided"}.`,
        sourceUrl: listUrl,
        confidence: 1,
        effectiveAt: null,
        lastSeenAt: observedAt,
        rawReference: `OFAC SDN UID ${uid || "unknown"}; ${idType}`,
        tags: programs,
        confirmed: true,
      };
      const key = `${chain}:${idNumber.toLowerCase()}`;
      const existing = records.get(key);
      if (!existing) {
        records.set(key, record);
        continue;
      }
      const names = new Set([...(existing.entityName ? existing.entityName.split("; ") : []), ...(record.entityName ? [record.entityName] : [])]);
      existing.entityName = [...names].join("; ").slice(0, 200) || null;
      existing.description = [...new Set([existing.description, record.description])].join(" | ").slice(0, 2000);
      existing.rawReference = [...new Set([...(existing.rawReference || "").split(" | "), ...(record.rawReference || "").split(" | ")].filter(Boolean))].join(" | ").slice(0, 300);
      existing.tags = [...new Set([...existing.tags, ...record.tags])].slice(0, 30);
    }
  }
  if (entryCount === 0) throw Object.assign(new Error("OFAC SDN XML has no entries"), { code: "SOURCE_INVALID_XML" });
  return [...records.values()];
}

async function readBoundedText(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxXmlBytes) {
    throw Object.assign(new Error("OFAC SDN file exceeds the configured size limit"), { code: "SOURCE_FILE_TOO_LARGE" });
  }
  const reader = response.body?.getReader();
  if (!reader) throw Object.assign(new Error("OFAC SDN response has no body"), { code: "SOURCE_INVALID_RESPONSE" });
  const chunks = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxXmlBytes) {
      await reader.cancel();
      throw Object.assign(new Error("OFAC SDN file exceeds the configured size limit"), { code: "SOURCE_FILE_TOO_LARGE" });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export const ofacSdnDigitalCurrencyAdapter = Object.freeze({
  getSourceMetadata() {
    return {
      id: "ofac-sdn-digital-currency",
      name: "OFAC SDN digital currency addresses",
      chains: ["TRON", "ETHEREUM", "BSC"],
      attributionUrl: "https://ofac.treasury.gov/sanctions-list-service",
      updateCadence: "Manual refresh only; 24-hour freshness target",
      freshnessMaxAgeHours: 24,
      maxRecordsPerRun: 10000,
      snapshot: true,
    };
  },
  async fetchRecords({ signal }) {
    const headers = { accept: "application/xml, text/xml;q=0.9", "user-agent": "ChainGuard/1.0" };
    let response = await fetch(sourceUrl, {
      headers,
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      let target;
      try { target = new URL(location, sourceUrl); } catch { throw Object.assign(new Error("OFAC SDN export redirect is invalid"), { code: "SOURCE_REDIRECT_BLOCKED" }); }
      if (target.protocol !== "https:" || target.hostname !== publishedFileHost || target.username || target.password) {
        throw Object.assign(new Error("OFAC SDN export redirected to an unapproved host"), { code: "SOURCE_REDIRECT_BLOCKED" });
      }
      response = await fetch(target, { headers, redirect: "error", signal });
    }
    if (!response.ok) throw Object.assign(new Error("OFAC SDN download failed"), { code: "SOURCE_FETCH_FAILED" });
    return parseOfacSdnXml(await readBoundedText(response));
  },
  normalizeRecord(record) {
    return record;
  },
});
