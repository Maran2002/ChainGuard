"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Copy, FileSearch2, Info, ShieldCheck } from "lucide-react";
import { Header, Sidebar } from "../../components/dashboard";
import AuthGate from "../../components/auth-gate";
import { createScreening, getCurrentUser } from "../../services/api";
import { formatDateTimeIST } from "../../utils/date-time";

function isValidAddress(chain, address) {
  if (chain === "TRON") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[a-fA-F0-9]{40}$/.test(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function sourceFreshnessDescription(source) {
  if (source.freshness === "CURRENT") return `Within the ${source.freshnessMaxAgeHours || "configured"}-hour freshness window.`;
  if (source.freshness === "STALE") return `Older than its ${source.freshnessMaxAgeHours}-hour freshness window.`;
  if (!source.lastUpdatedAt) return "No successful snapshot has been applied in this environment.";
  if (source.freshnessUsesSourceTimestamp && !source.sourceGeneratedAt) return "The source generation time is missing, so its age cannot be verified.";
  return "The source age could not be verified.";
}

function EvidenceFactors({ factors = [] }) {
  return <section className="result-evidence-section" aria-label="Screening evidence">
    <div className="result-section-heading"><div><b>Evidence</b><small>Signals that contributed to this result</small></div><span>{factors.length} factor{factors.length === 1 ? "" : "s"}</span></div>
    {factors.length === 0
      ? <div className="result-no-evidence"><ShieldCheck size={17} /><div><b>No matching evidence found</b><p>No risk records matched this address in the sources queried. Because coverage is incomplete, this does not mean the address is safe.</p></div></div>
      : <div className="result-evidence-cards">{factors.map((factor, index) => {
        const isExposure = factor.kind === "COUNTERPARTY_EXPOSURE";
        const confidence = Number.isFinite(factor.confidence) ? `${Math.round(factor.confidence * 100)}%` : null;
        const evidenceType = isExposure ? `${factor.distance || 1}-hop counterparty exposure` : factor.kind === "DIRECT_MATCH" ? "Direct address match" : factor.kind || "Risk signal";
        return <article className={`result-evidence-card ${isExposure ? "result-evidence-exposure" : "result-evidence-direct"}`} key={`${factor.sourceId || factor.name}-${index}`}>
          <div className="result-evidence-card-top"><span className="result-evidence-kind">{evidenceType}</span><span className="result-evidence-category">{String(factor.category || "SIGNAL").replaceAll("_", " ")}</span></div>
          <div className="result-evidence-title-row"><div><h3>{factor.name || factor.category || "Risk signal"}</h3><p>{factor.explanation}</p></div><span className="result-factor-score">{factor.score}<small>factor score</small></span></div>
          <div className="result-evidence-meta">
            <span>Source <b>{factor.source || "Not provided"}</b></span>
            {confidence && <span>Confidence <b>{confidence}</b></span>}
            {factor.kind === "DIRECT_MATCH" && <span>Confirmation <b>{factor.confirmed ? "Confirmed" : "Unconfirmed label"}</b></span>}
            {factor.timestamp && <span>Reported <b>{formatDateTimeIST(factor.timestamp)}</b></span>}
            {factor.counterpartyAddress && <span className="result-evidence-address">Connected address <b>{factor.counterpartyAddress}</b></span>}
            {factor.sourceUrl && <a href={factor.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={12} /></a>}
          </div>
        </article>;
      })}</div>}
  </section>;
}

function ScreeningResult({ result, depth, copyState, onCopy }) {
  if (!result) return null;
  const verdict = result.risk?.verdict || "UNKNOWN";
  const coverage = result.risk?.coverage;
  const sources = coverage?.sourceFreshness || [];
  const evidenceFactors = result.risk?.riskFactors || [];
  const attentionNeeded = sources.some((source) => source.freshness !== "CURRENT");
  const freshnessStatus = sources.length === 0 ? "UNKNOWN" : attentionNeeded ? "NEEDS ATTENTION" : "CURRENT";
  const isInconclusive = verdict === "UNKNOWN";
  return <section className="screen-result" aria-live="polite">
    <div className="result-top">
      <div><h2>{result.localOnly ? "Screening could not be confirmed" : isInconclusive ? "Screening is inconclusive" : "Screening completed"}</h2><p>{result.chain} · {result.address}</p></div>
      <div className="result-indicators"><span className={`risk-pill risk-${verdict.toLowerCase()}`}><span /> {verdict}</span><span className="result-score">{result.risk?.riskScore ?? "Not scored"}{result.risk?.riskScore != null && <small>/100</small>}</span></div>
    </div>
    {!result.localOnly && isInconclusive && <div className="result-explanation"><b><AlertTriangle size={14} /> Why the verdict is UNKNOWN</b><p>No matching risk evidence was found in the sources queried. The result cannot be labeled LOW because source coverage is incomplete or stale. A LIVE history provider means the chain request succeeded; it does not mean all risk sources are complete or current.</p></div>}
    {!result.localOnly && result.risk && <EvidenceFactors factors={evidenceFactors} />}
    <div className="result-status-grid">
      <div><span>History provider</span><b>{result.risk?.providerStatus || "UNAVAILABLE"}</b><small>{result.risk?.providerStatus === "LIVE" ? "The chain history request succeeded." : "No live chain history was confirmed."}</small></div>
      <div><span>Intelligence coverage</span><b>{coverage?.status || "NOT QUERIED"}</b><small>Some risk categories or sources are not covered.</small></div>
      <div><span>Source freshness</span><b>{freshnessStatus}</b><small>{attentionNeeded ? "At least one applicable source is stale or has no verified snapshot." : "Applicable source snapshots are current."}</small></div>
      <div><span>History depth</span><b>{depth} hop{depth === 1 ? "" : "s"}</b><small>Connected wallets checked in the saved history.</small></div>
    </div>
    <div className="result-next-step"><b>{result.localOnly ? "What happened" : "Recommended next step"}</b><p>{result.localOnly ? `${result.requestError} The API did not confirm whether a screening was saved. Check your history before retrying.` : result.risk?.recommendedAction || "Review source coverage before relying on this result."}{!result.localOnly && result.txHash ? ` Transaction ${result.txHash} was saved with the result but not queried because a transaction provider is not configured.` : ""}</p></div>
    {sources.length > 0 && <section className="result-source-section" aria-label="Applicable intelligence source freshness"><div className="result-section-heading"><b>Applicable intelligence sources</b><span>Freshness is checked per source</span></div><div className="result-source-list">{sources.map((source) => <article className="result-source-card" key={source.id}>
      <div className="result-source-heading"><b>{source.name}</b><span className={`freshness-tag freshness-${source.freshness.toLowerCase()}`}>{source.freshness}</span></div>
      <p>{sourceFreshnessDescription(source)}</p>
      <div className="result-source-dates">
        {source.sourceGeneratedAt && <span>Snapshot generated <b>{formatDateTimeIST(source.sourceGeneratedAt)}</b></span>}
        {source.lastUpdatedAt && <span>Applied <b>{formatDateTimeIST(source.lastUpdatedAt)}</b></span>}
        {!source.lastUpdatedAt && <span>No successful apply recorded</span>}
      </div>
    </article>)}</div></section>}
    {coverage?.notes?.length > 0 && <div className="result-coverage-notes"><b>Coverage notes</b><ul>{coverage.notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></div>}
    <p className="result-disclaimer">This result reflects only the sources and coverage available at screening time. No matches do not prove that a wallet is safe.</p>
    {result.risk && <p className="result-exposure-note"><b>Counterparty check</b><span>{result.risk.exposureSummary?.findings || 0} connected wallets matched within {depth} hop{depth === 1 ? "" : "s"}.{result.risk.exposureSummary?.truncated ? " The search reached its limits; further matches may exist." : " Connectivity alone does not establish the flow of funds."}</span></p>}
    {result.screening?._id && <div className="screen-result-actions">
      <div><Link href={`/history/${result.screening._id}`} className="secondary-button">Open saved result <ArrowRight size={13} /></Link><button className="secondary-button" onClick={() => void onCopy(result.screening._id)}>{copyState.startsWith("Copied") ? <Check size={13} /> : <Copy size={13} />}{copyState.startsWith("Copied") ? "Copied" : "Copy private reference"}</button></div>
      <small>Only the account that created this screening can open its saved reference.</small>
      {copyState && <span role="status">{copyState}</span>}
    </div>}
  </section>;
}

function ScreenView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chain, setChain] = useState("TRON");
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [depth, setDepth] = useState("1");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState("");
  const addressInput = useRef(null);

  useEffect(() => {
    getCurrentUser().then(({ user }) => {
      setChain(user.preferences?.defaultChain || "TRON");
      setDepth(String(user.preferences?.defaultInvestigationDepth || 1));
    }).catch(() => {
      setChain("TRON");
      setDepth("1");
    });
  }, []);

  useEffect(() => {
    const focusAddress = () => window.requestAnimationFrame(() => addressInput.current?.focus());
    window.addEventListener("chainguard:focus-wallet", focusAddress);
    if (window.sessionStorage.getItem("chainguard:focus-wallet") === "true") {
      window.sessionStorage.removeItem("chainguard:focus-wallet");
      focusAddress();
    }
    return () => window.removeEventListener("chainguard:focus-wallet", focusAddress);
  }, []);

  async function copyPrivateReference(screeningId) {
    const reference = `${window.location.origin}/history/${encodeURIComponent(screeningId)}`;
    try {
      await navigator.clipboard.writeText(reference);
      setCopyState("Copied. This private link requires the screening owner’s account.");
    } catch {
      setCopyState("Clipboard access is unavailable. Open the saved result and copy its address from the browser.");
    }
  }

  async function submitScreening(event) {
    event.preventDefault();
    const normalized = address.trim();
    if (!isValidAddress(chain, normalized)) {
      setError(`Enter a valid ${chain} address.`);
      setResult(null);
      return;
    }
    if (txHash.trim() && !/^(0x)?[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      setError("Enter a valid 64-character transaction hash, or leave it blank.");
      setResult(null);
      return;
    }
    setAddress(normalized);
    setError("");
    setCopyState("");
    setBusy(true);
    try {
      const response = await createScreening({ chain, address: normalized, transactionHash: txHash.trim() || undefined, depth: Number(depth) });
      setResult({ ...response, address: normalized, chain, txHash: txHash.trim(), localOnly: false });
    } catch (requestError) {
      setResult({ address: normalized, chain, txHash: txHash.trim(), localOnly: true, requestError: requestError.message });
    } finally {
      setBusy(false);
    }
  }

  return <AuthGate><div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content screen-page">
    {/* <div className="demo-banner"><span className="demo-pulse" /><b>DEVELOPMENT MODE</b><span>Live screening providers are not connected. Mock mode uses labeled fixtures; otherwise submissions validate addresses only.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INVESTIGATIONS</div><h1>Screen a wallet</h1><p>Check an address against configured intelligence and transaction sources.</p></div></div>
    <form className="screen-card screen-form" onSubmit={submitScreening}>
      <label className="field-label">Blockchain network<select className="form-control form-select" value={chain} onChange={(event) => { setChain(event.target.value); setError(""); setResult(null); }}><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select><small>Provider readiness is shown in the result.</small></label>
      <label className="field-label">Wallet address<input ref={addressInput} id="wallet-address" className="form-control" autoComplete="off" spellCheck="false" placeholder={chain === "TRON" ? "Enter a TRON address (T…)" : "Enter a 0x address"} value={address} onChange={(event) => setAddress(event.target.value)} aria-invalid={Boolean(error)} />{error && <small className="form-error">{error}</small>}</label>
      <label className="field-label full">Transaction hash <small>Optional</small><input className="form-control" autoComplete="off" spellCheck="false" placeholder="Paste a transaction hash to include it in the investigation" value={txHash} onChange={(event) => setTxHash(event.target.value)} /></label>
      <label className="field-label">Investigation depth<select className="form-control form-select" value={depth} onChange={(event) => setDepth(event.target.value)}><option value="1">1 hop · Direct counterparties</option><option value="2">2 hops · Extended exposure</option></select><small>Maximum depth is 2 hops.</small></label>
      <div className="screen-actions"><p><Info size={14} /> Risk decisions require configured intelligence and blockchain providers.</p><button className="primary-button" type="submit" disabled={busy}><FileSearch2 size={15} /> {busy ? "Checking sources…" : "Validate & screen"} <ArrowRight size={14} /></button></div>
    </form>
    <ScreeningResult result={result} depth={depth} copyState={copyState} onCopy={copyPrivateReference} />
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Before you investigate</h2><p>Coverage and provider configuration determine what a result can tell you.</p></div><ShieldCheck size={18} color="#7c9ed7" /></div><div className="guidance-list"><div><b>Live sources</b><span>Provider status is shown in the result and can vary by network and environment.</span></div><div><b>Address validation</b><span>Format validation helps catch input mistakes; it does not verify ownership or activity.</span></div><div><b>Risk verdicts</b><span>An incomplete source check returns UNKNOWN rather than claiming the wallet is safe.</span></div></div></section>
  </div></main></div></AuthGate>;
}

export default function ScreenPage() {
  return <ScreenView />;
}
