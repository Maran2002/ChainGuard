"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, FileSearch2, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { Header, Sidebar } from "../../components/dashboard";
import AuthGate from "../../components/auth-gate";
import { createScreening } from "../../services/api";

function isValidAddress(chain, address) {
  if (chain === "TRON") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[a-fA-F0-9]{40}$/.test(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default function ScreenPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chain, setChain] = useState("TRON");
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [depth, setDepth] = useState("1");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

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
    <div className="demo-banner"><span className="demo-pulse" /><b>DEVELOPMENT MODE</b><span>Live screening providers are not connected. Submissions validate addresses only.</span></div>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INVESTIGATIONS</div><h1>Screen a wallet</h1><p>Check an address against configured intelligence and transaction sources.</p></div></div>
    <form className="screen-card screen-form" onSubmit={submitScreening}>
      <label className="field-label">Blockchain network<select className="form-control form-select" value={chain} onChange={(event) => { setChain(event.target.value); setError(""); setResult(null); }}><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select><small>Provider readiness is shown in the result.</small></label>
      <label className="field-label">Wallet address<input className="form-control" autoComplete="off" spellCheck="false" placeholder={chain === "TRON" ? "Enter a TRON address (T…)" : "Enter a 0x address"} value={address} onChange={(event) => setAddress(event.target.value)} aria-invalid={Boolean(error)} />{error && <small className="form-error">{error}</small>}</label>
      <label className="field-label full">Transaction hash <small>Optional</small><input className="form-control" autoComplete="off" spellCheck="false" placeholder="Paste a transaction hash to include it in the investigation" value={txHash} onChange={(event) => setTxHash(event.target.value)} /></label>
      <label className="field-label">Investigation depth<select className="form-control form-select" value={depth} onChange={(event) => setDepth(event.target.value)}><option value="1">1 hop · Direct counterparties</option><option value="2">2 hops · Extended exposure</option></select><small>Maximum depth is 2 hops.</small></label>
      <div className="screen-actions"><p><Info size={14} /> Risk decisions require configured intelligence and blockchain providers.</p><button className="primary-button" type="submit" disabled={busy}><FileSearch2 size={15} /> {busy ? "Checking sources…" : "Validate & screen"} <ArrowRight size={14} /></button></div>
    </form>
    {result && <section className="screen-result" aria-live="polite"><div className="result-top"><div><h2>{result.localOnly ? "Address format validated" : "Screening completed"}</h2><p>{result.chain} · {result.address}</p></div><div className="result-indicators"><span className={`risk-pill risk-${(result.risk?.verdict || "UNKNOWN").toLowerCase()}`}><span /> {result.risk?.verdict || "UNKNOWN"}</span><span className="result-score">{result.risk?.riskScore ?? "—"}<small>/100</small></span></div></div><p className="result-copy">{result.localOnly ? `${result.requestError} No source query or screening record was created.` : result.risk?.recommendedAction}{result.txHash ? ` Transaction ${result.txHash} was accepted for the record but not queried because a transaction provider is not configured.` : ""}</p><div className="result-evidence"><ShieldAlert size={15} /> Provider status: <b>{result.risk?.providerStatus || "UNAVAILABLE"}</b> · Coverage: {result.risk?.coverage?.status || "NOT QUERIED"} · Depth {depth}</div>{result.risk?.riskFactors?.length > 0 && <div className="screen-evidence-list"><b>Evidence factors</b>{result.risk.riskFactors.map((factor, index) => <div key={`${factor.sourceId || factor.name}-${index}`}><span>{factor.name}</span><small>{factor.explanation}</small></div>)}</div>}<div className="result-foot"><AlertTriangle size={13} /> {result.risk?.noMatchesMessage || result.risk?.coverage?.notes?.join(" · ") || "No known matches can be reported until configured sources are available."}</div></section>}
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Before you investigate</h2><p>Coverage and provider configuration determine what a result can tell you.</p></div><ShieldCheck size={18} color="#7c9ed7" /></div><div className="guidance-list"><div><b>Live sources</b><span>Server provider credentials are not configured in this workspace yet.</span></div><div><b>Address validation</b><span>Format validation helps catch input mistakes; it does not verify ownership or activity.</span></div><div><b>Risk verdicts</b><span>An incomplete source check must return UNKNOWN, never a “safe” verdict.</span></div></div></section>
  </div></main></div></AuthGate>;
}
