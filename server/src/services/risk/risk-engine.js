export const RISK_MODEL_VERSION = "1.0.0";

const severity = Object.freeze({ LOW: 20, MEDIUM: 42, HIGH: 68, CRITICAL: 90 });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function confidenceOf(value) {
  return clamp(value ?? 0.5, 0, 1);
}

function factorTimestamp(item) {
  return item.lastSeenAt || item.effectiveAt || item.occurredAt || null;
}

function sourceFactor(item, kind, score, explanation) {
  return {
    name: item.label || item.entityName || item.category || kind,
    kind,
    score,
    weight: item.weight ?? null,
    source: item.sourceName || item.source || "Unattributed finding",
    sourceId: item.sourceId || item.recordId || null,
    confidence: confidenceOf(item.confidence),
    explanation,
    timestamp: factorTimestamp(item),
  };
}

function directFactors(records = []) {
  return records.map((record) => {
    const category = String(record.category || "OTHER").toUpperCase();
    const riskLevel = String(record.riskLevel || "MEDIUM").toUpperCase();
    const confidence = confidenceOf(record.confidence);
    const confirmed = record.confirmed === true;
    let base = severity[riskLevel] || 35;
    if (category === "SANCTIONED") base = confirmed ? 100 : Math.max(base, 68);
    if (category === "FROZEN") base = confirmed ? 95 : Math.max(base, 68);
    const score = Math.round(base * confidence);
    const explanation = confirmed && category === "SANCTIONED"
      ? "Confirmed direct sanctions record."
      : confirmed && category === "FROZEN"
        ? "Confirmed issuer freeze record."
        : `Direct ${category.toLowerCase()} intelligence match; confirmation and confidence are shown separately.`;
    return { ...sourceFactor(record, "DIRECT_MATCH", score, explanation), category, confirmed };
  });
}

function exposureFactors(findings = []) {
  return findings.map((finding) => {
    const distance = clamp(Math.floor(finding.distance ?? 1), 1, 2);
    const base = severity[String(finding.riskLevel || "MEDIUM").toUpperCase()] || 42;
    const distanceScale = distance === 1 ? 1 : 0.6;
    const amount = Number(finding.exposureValueUsd) || 0;
    const amountBonus = amount >= 100000 ? 10 : amount >= 10000 ? 5 : 0;
    const score = Math.round(Math.min(80, (base * distanceScale + amountBonus) * confidenceOf(finding.confidence)));
    const explanation = `${distance}-hop counterparty exposure${amountBonus ? ` with at least $${amountBonus === 10 ? "100,000" : "10,000"} reported exposure` : ""}; this is an exposure indicator, not a direct designation.`;
    return { ...sourceFactor(finding, "COUNTERPARTY_EXPOSURE", score, explanation), distance };
  });
}

function behaviorFactors(findings = []) {
  return findings.map((finding) => {
    const weight = clamp(finding.weight ?? 10, 0, 30);
    const score = Math.round(weight * confidenceOf(finding.confidence));
    const explanation = finding.explanation || "Heuristic behavior indicator; it is not a confirmed identity or sanctions match.";
    return sourceFactor({ ...finding, weight }, "BEHAVIOR", score, explanation);
  });
}

function verdictFor(score, hasAdequateCoverage, hasKnownEvidence, hasConfirmedCritical) {
  if (hasConfirmedCritical) return "CRITICAL";
  if (!hasAdequateCoverage && !hasKnownEvidence) return "UNKNOWN";
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function nextAction(verdict, hasCoverage) {
  if (!hasCoverage) return "Configure providers and repeat the investigation before making a decision.";
  if (verdict === "CRITICAL") return "Escalate for immediate compliance review and follow applicable policy.";
  if (verdict === "HIGH") return "Pause interaction and review the cited evidence with a compliance analyst.";
  if (verdict === "MEDIUM") return "Review exposure and behavioral factors before proceeding.";
  if (verdict === "LOW") return "No known matches found in the configured sources; this is not a guarantee of safety.";
  return "Obtain broader, fresher source coverage before drawing a conclusion.";
}

export function calculateRisk(input) {
  const direct = directFactors(input.directMatches);
  if (input.issuerFreezeMatch) direct.push(...directFactors([{ ...input.issuerFreezeMatch, category: "FROZEN", confirmed: input.issuerFreezeMatch.confirmed === true }]));
  const exposure = exposureFactors(input.exposureFindings);
  const behavior = behaviorFactors(input.behaviorFindings);
  const factors = [...direct, ...exposure, ...behavior];
  const confirmedCritical = direct.some((item) => item.confirmed && ["SANCTIONED", "FROZEN"].includes(item.category));
  const providerStatus = input.providerStatus || "UNAVAILABLE";
  const coverageComplete = input.coverage?.complete === true && input.coverage?.fresh === true && !(input.providerErrors?.length) && providerStatus !== "UNAVAILABLE";
  const hasKnownEvidence = factors.some((factor) => factor.score > 0);
  const maxDirect = Math.max(0, ...direct.map((factor) => factor.score));
  const maxExposure = Math.max(0, ...exposure.map((factor) => factor.score));
  const behaviorTotal = Math.min(45, behavior.reduce((sum, factor) => sum + factor.score, 0));
  const exposureTotal = exposure.reduce((sum, factor) => sum + factor.score, 0);
  const interactionPoints = Math.min(20, Math.max(0, exposureTotal - maxExposure) + Math.floor(behaviorTotal * 0.25));
  const score = Math.min(100, Math.max(maxDirect, maxExposure, behaviorTotal) + interactionPoints);
  const verdict = verdictFor(score, coverageComplete, hasKnownEvidence, confirmedCritical);

  return {
    chain: input.chain,
    address: input.address,
    verdict,
    riskScore: verdict === "UNKNOWN" ? null : score,
    riskFactors: factors.sort((left, right) => right.score - left.score),
    matchedRecords: direct,
    exposureSummary: { findings: exposure.length, maxDistance: exposure.length ? Math.max(...exposure.map((item) => item.distance)) : 0 },
    behaviorSummary: { findings: behavior.length },
    coverage: {
      status: coverageComplete ? "COMPLETE" : "INCOMPLETE",
      freshness: input.coverage?.fresh === true ? "CURRENT" : "STALE_OR_UNKNOWN",
      sources: input.coverage?.sources || [],
      providerErrors: input.providerErrors || [],
    },
    providerStatus,
    recommendedAction: nextAction(verdict, coverageComplete),
    noMatchesMessage: verdict === "LOW" && !hasKnownEvidence ? "No known matches found in the configured sources." : null,
    riskModelVersion: RISK_MODEL_VERSION,
  };
}
