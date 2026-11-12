"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Fingerprint, RefreshCw, ShieldAlert } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { getIntelligenceRecord } from "../../../services/api";

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function RecordDetails() {
  const { recordId } = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadRecord() {
    setLoading(true);
    setError("");
    try {
      const response = await getIntelligenceRecord(recordId);
      setRecord(response.record);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRecord(); }, [recordId]);
  const sourceUrl = safeHttpUrl(record?.sourceUrl);

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <Link href="/directory" className="text-link detail-back"><ArrowLeft size={14} /> Back to directory</Link>
    {loading && <div className="panel directory-state"><RefreshCw className="spin" size={20} /> Loading intelligence record…</div>}
    {!loading && error && <div className="panel directory-state"><ShieldAlert size={22} /><h2>Record unavailable</h2><p>{error}</p><button className="primary-button" onClick={() => void loadRecord()}><RefreshCw size={14} /> Retry</button></div>}
    {!loading && record && <><div className="page-heading detail-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INTELLIGENCE RECORD</div><h1>{record.entityName || "Wallet record"}</h1><p className="detail-address">{record.chain} · {record.address}</p></div><span className={`risk-pill risk-${record.riskLevel.toLowerCase()}`}><span />{record.riskLevel}</span></div><div className="detail-grid"><section className="panel detail-card"><h2>Record classification</h2><div className="detail-rows"><span>Category</span><b>{record.category}</b><span>Entity</span><b>{record.entityName || "Not specified"}</b><span>Source confidence</span><b>{Math.round(record.confidence * 100)}%</b><span>Confirmation</span><b>{record.confirmed ? "Confirmed by source metadata" : "Unconfirmed intelligence"}</b><span>Effective date</span><b>{record.effectiveAt ? new Date(record.effectiveAt).toLocaleString() : "Not specified"}</b><span>Last seen</span><b>{record.lastSeenAt ? new Date(record.lastSeenAt).toLocaleString() : "Not specified"}</b><span>Ingested</span><b>{new Date(record.ingestedAt).toLocaleString()}</b></div></section><section className="panel detail-card"><h2>Source and evidence</h2><div className="source-detail"><Fingerprint size={18} /><div><b>{record.sourceName}</b><small>Reference: {record.sourceId}</small></div></div><p className="record-description">{record.description || "The source did not provide a description."}</p>{record.rawReference && <div className="detail-reference"><span>Source reference</span><b>{record.rawReference}</b></div>}{record.tags?.length > 0 && <div className="record-tags">{record.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}{sourceUrl && <a className="source-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open source record <ExternalLink size={13} /></a>}</section></div></>}
  </div></main></div>;
}

export default function IntelligenceRecordPage() {
  return <AuthGate><RecordDetails /></AuthGate>;
}
