"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, FileSearch2, Network, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { deleteScreeningRecord, getScreeningRecord, reinvestigateScreeningRecord } from "../../../services/api";
import { formatDateTimeIST as formatDate } from "../../../utils/date-time";

function SavedScreeningView() {
  const { screeningId } = useParams();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [screening, setScreening] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadScreening = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await getScreeningRecord(screeningId);
      setScreening(response.screening);
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }, [screeningId]);

  useEffect(() => { void loadScreening(); }, [loadScreening]);

  async function reinvestigate() {
    setBusy(true);
    setError("");
    try {
      const response = await reinvestigateScreeningRecord(screeningId, screening?.investigationDepth || 1);
      router.push(`/history/${response.screening._id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteScreeningRecord(screeningId);
      router.replace("/history");
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <Link href="/history" className="text-link saved-back"><ArrowLeft size={14} /> Back to screening history</Link>
    {status === "loading" && <div className="panel history-state"><RefreshCw className="spin" size={19} /> Loading saved result…</div>}
    {status === "error" && <div className="panel history-state"><ShieldAlert size={23} /><h2>Screening unavailable</h2><p>{error}</p><button className="primary-button" onClick={() => void loadScreening()}><RefreshCw size={14} /> Retry</button></div>}
    {screening && status === "ready" && <>
      {/* <div className="demo-banner"><span className="demo-pulse" /><b>SAVED RESULT</b><span>Coverage and provider status are preserved from the original screening.</span></div> */}
      <div className="page-heading saved-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {screening.chain} SCREENING</div><h1>{screening.address}</h1><p>Screened {formatDate(screening.screenedAt)} · Model {screening.riskModelVersion}</p></div><span className={`risk-pill risk-${screening.verdict.toLowerCase()}`}><span />{screening.verdict}</span></div>
      {error && <div className="history-error" role="alert"><ShieldAlert size={15} />{error}</div>}
      <div className="saved-actions"><button className="primary-button" onClick={() => void reinvestigate()} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} /> {busy ? "Starting new screening…" : "Re-screen this wallet"}</button><Link className="secondary-button" href={`/investigate/${screening._id}`}><Network size={14} /> Transaction graph</Link><button className="secondary-button" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} /> Delete record</button></div>
      {confirmDelete && <div className="history-confirm"><span>Delete this result from your account? This does not remove source intelligence.</span><div><button className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button><button className="history-confirm-delete" onClick={() => void remove()} disabled={busy}>{busy ? "Deleting…" : "Delete screening"}</button></div></div>}

      <section className="saved-metrics"><article className="panel saved-metric"><span>Risk score</span><b>{screening.riskScore ?? "—"}<small>{screening.riskScore == null ? "" : " / 100"}</small></b></article><article className="panel saved-metric"><span>Provider</span><b className={`provider-tag provider-${screening.providerStatus.toLowerCase()}`}>{screening.providerStatus}</b></article><article className="panel saved-metric"><span>Matched records</span><b>{screening.matchedRecords?.length || 0}</b></article><article className="panel saved-metric"><span>Duration</span><b>{screening.durationMs} <small>ms</small></b></article></section>

      <section className="saved-detail-grid"><article className="panel saved-card"><div className="panel-heading"><div><h2>Coverage and next action</h2><p>What the original check could and could not verify.</p></div><ShieldCheck size={18} color="#7c9ed7" /></div><div className="saved-coverage"><div><span>Coverage</span><b>{screening.coverage?.complete ? "Complete" : "Incomplete"}</b></div><div><span>Freshness</span><b>{screening.coverage?.fresh ? "Current" : "Unknown or stale"}</b></div><div><span>Provider status</span><b>{screening.providerStatus}</b></div></div>{screening.coverage?.sourceFreshness?.length > 0 && <div className="saved-notes">{screening.coverage.sourceFreshness.map((source) => <div key={source.id}>{source.name}: {source.freshness.toLowerCase()}{source.lastUpdatedAt ? ` · refreshed ${formatDate(source.lastUpdatedAt)}` : " · never applied"}</div>)}</div>}<p className="saved-recommendation">{screening.recommendedAction}</p>{screening.coverage?.notes?.length > 0 && <ul className="saved-notes">{screening.coverage.notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>}</article>
        <article className="panel saved-card"><div className="panel-heading"><div><h2>Screening details</h2><p>Request context stored with this result.</p></div><Clock3 size={17} color="#8999b3" /></div><div className="saved-coverage"><div><span>Address</span><b className="saved-mono">{screening.address}</b></div><div><span>Chain</span><b>{screening.chain}</b></div><div><span>Transaction hash</span><b className="saved-mono">{screening.transactionHash || "Not supplied"}</b></div><div><span>Requested depth</span><b>{screening.investigationDepth || 1} hop{(screening.investigationDepth || 1) === 1 ? "" : "s"}</b></div><div><span>Risk model</span><b>{screening.riskModelVersion}</b></div></div></article></section>

      <section className="panel saved-evidence-panel"><div className="panel-heading"><div><h2>Risk factors and matched intelligence</h2><p>Evidence available when this result was created.</p></div><span className="saved-evidence-count">{(screening.riskFactors?.length || 0) + (screening.matchedRecords?.length || 0)} items</span></div>
        {[...(screening.riskFactors || []), ...(screening.matchedRecords || [])].length === 0 ? <div className="saved-no-evidence"><ShieldCheck size={17} /><span>No specific risk factors or intelligence records were saved with this result.</span></div> : <div className="saved-evidence-list">{[...(screening.riskFactors || []).map((item) => ({ ...item, evidenceType: "Risk factor" })), ...(screening.matchedRecords || []).map((item) => ({ ...item, evidenceType: "Intelligence match" }))].map((item, index) => <article className="saved-evidence-item" key={`${item.sourceId || item.name || item.evidenceType}-${index}`}><span className="saved-evidence-type">{item.evidenceType}</span><div><b>{item.name || item.category || "Matched record"}</b><p>{item.explanation || item.source || item.sourceId || "No additional explanation was provided."}</p></div>{typeof item.confidence === "number" && <small>{Math.round(item.confidence * 100)}% confidence</small>}</article>)}</div>}
      </section>
      <section className="panel saved-card" style={{ marginTop: 12 }}><div className="panel-heading"><div><h2>Counterparty exposure</h2><p>{screening.exposureSummary?.findings || 0} connected wallets matched intelligence within {screening.exposureSummary?.maxDistance || 0} hops.</p></div></div><p className="saved-recommendation">These findings describe wallet connectivity, not proven funds flow or a direct designation of the screened wallet. Source and counterparty details appear in the saved risk factors above.</p>{screening.exposureSummary?.truncated && <p className="result-disclaimer">The screening reached its exposure search limit. Additional matches may have been omitted.</p>}</section>
    </>}
  </div></main></div>;
}

export default function SavedScreeningPage() {
  return <AuthGate><SavedScreeningView /></AuthGate>;
}
