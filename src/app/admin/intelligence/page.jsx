"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, ShieldX, X } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { createAdminIntelligenceRecord, getAdminIntelligence, updateAdminIntelligenceRecord } from "../../../services/api";

const categories = ["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"];
const riskLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const blankRecord = () => ({ chain: "TRON", address: "", category: "SCAM", riskLevel: "HIGH", entityName: "", description: "", sourceUrl: "", confidence: "0.5", tags: "", confirmed: false });

function RecordFields({ value, onChange, editing = false }) {
  const field = (name, next) => onChange((current) => ({ ...current, [name]: next }));
  return <div className="intelligence-form-grid">
    <label>Chain<select value={value.chain} disabled={editing} onChange={(event) => field("chain", event.target.value)}><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select></label>
    <label>Wallet address<input value={value.address} disabled={editing} required maxLength={160} onChange={(event) => field("address", event.target.value)} placeholder="Wallet address" /></label>
    <label>Category<select value={value.category} onChange={(event) => field("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label>Risk level<select value={value.riskLevel} onChange={(event) => field("riskLevel", event.target.value)}>{riskLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
    <label>Entity name<input value={value.entityName || ""} maxLength={200} onChange={(event) => field("entityName", event.target.value)} placeholder="Optional label" /></label>
    <label>Confidence<input type="number" min="0" max="1" step="0.01" value={value.confidence} onChange={(event) => field("confidence", event.target.value)} /></label>
    <label className="intelligence-form-wide">Evidence description<textarea value={value.description || ""} required={!editing} minLength={editing ? 0 : 10} maxLength={2000} rows={3} onChange={(event) => field("description", event.target.value)} placeholder="Explain why this record belongs in the intelligence directory." /></label>
    <label className="intelligence-form-wide">Public HTTPS evidence URL<input type="url" value={value.sourceUrl || ""} maxLength={1000} onChange={(event) => field("sourceUrl", event.target.value)} placeholder="https://… (optional)" /></label>
    <label className="intelligence-form-wide">Tags<input value={value.tags || ""} onChange={(event) => field("tags", event.target.value)} placeholder="Comma-separated tags" /></label>
    <label className="intelligence-check"><input type="checkbox" checked={Boolean(value.confirmed)} onChange={(event) => field("confirmed", event.target.checked)} /> Evidence manually reviewed and confirmed</label>
    {editing && <label className="intelligence-check"><input type="checkbox" checked={Boolean(value.isActive)} onChange={(event) => field("isActive", event.target.checked)} /> Active in the directory</label>}
    {editing && value.isActive === false && <label className="intelligence-check intelligence-danger-check"><input type="checkbox" checked={Boolean(value.confirmDeactivate)} onChange={(event) => field("confirmDeactivate", event.target.checked)} /> I confirm removing this record from active directory results</label>}
  </div>;
}

function AdminIntelligenceView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState({ q: "", chain: "", category: "", riskLevel: "", includeInactive: "true", page: 1, limit: 25, sort: "newest" });
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(blankRecord);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => current.q === queryText.trim() && current.page === 1 ? current : { ...current, q: queryText.trim(), page: 1 }), 250);
    return () => clearTimeout(timer);
  }, [queryText]);

  const loadRecords = useCallback(async () => {
    setStatus("loading");
    setError("");
    setForbidden(false);
    try {
      const response = await getAdminIntelligence(query);
      setRecords(response.data || []);
      setMeta(response.meta || null);
      setStatus("ready");
    } catch (requestError) {
      if (requestError.status === 403) {
        setForbidden(true);
        setStatus("ready");
        return;
      }
      setError(requestError.message || "Intelligence records are unavailable.");
      setStatus("error");
    }
  }, [query]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  function setFilter(key, value) {
    setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function valuesForApi(form, includeIdentity = false) {
    return {
      ...(includeIdentity ? { chain: form.chain, address: form.address?.trim() } : {}),
      category: form.category,
      riskLevel: form.riskLevel,
      entityName: form.entityName?.trim() || null,
      description: form.description?.trim() || "",
      sourceUrl: form.sourceUrl?.trim() || null,
      confidence: Number(form.confidence),
      tags: String(form.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30),
      confirmed: Boolean(form.confirmed),
      ...(typeof form.isActive === "boolean" ? { isActive: form.isActive } : {}),
    };
  }

  async function createRecord(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await createAdminIntelligenceRecord(valuesForApi(createForm, true));
      setCreateForm(blankRecord());
      setCreateOpen(false);
      setNotice("Manual intelligence record created and written to the audit log.");
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message || "The intelligence record could not be created.");
    } finally {
      setWorking(false);
    }
  }

  async function updateRecord(event) {
    event.preventDefault();
    if (!editing) return;
    if (editing.isActive === false && !editing.confirmDeactivate) {
      setError("Confirm that you want to deactivate this record.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await updateAdminIntelligenceRecord(editing._id, valuesForApi(editing));
      setEditing(null);
      setNotice("Intelligence record updated and written to the audit log.");
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message || "The intelligence record could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  function openEditor(record) {
    setError("");
    setEditing({ ...record, confidence: String(record.confidence), tags: (record.tags || []).join(", "), confirmDeactivate: false });
  }

  const filtersActive = Boolean(query.q || query.chain || query.category || query.riskLevel);
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    {/* <div className="demo-banner"><ShieldCheck size={14} /><b>ADMIN CURATION</b><span>Manual records require an evidence note and all changes are audited.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE ADMIN</div><h1>Intelligence records</h1><p>Add, review, or deactivate curated wallet intelligence.</p></div><button className="primary-button" onClick={() => { setError(""); setCreateOpen((current) => !current); }}><Plus size={15} /> Add record</button></div>
    {notice && <div className="ingestion-notice"><span><ShieldCheck size={15} /></span><div><b>Saved</b><small>{notice}</small></div></div>}
    {error && status !== "error" && <div className="ingestion-inline-error" role="alert">{error}</div>}
    {forbidden && <section className="panel ingestion-access"><ShieldX size={24} /><h2>Administrator access required</h2><p>This page is limited to accounts with the ADMIN role.</p></section>}
    {!forbidden && <>
      {createOpen && <form className="panel intelligence-editor" onSubmit={createRecord}><div className="panel-heading"><div><h2>Add a manual record</h2><p>Only public HTTPS citations are accepted. This form does not fetch the submitted URL.</p></div><button type="button" className="icon-button" aria-label="Close new record form" onClick={() => setCreateOpen(false)}><X size={16} /></button></div><RecordFields value={createForm} onChange={setCreateForm} /><div className="intelligence-form-actions"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-button" disabled={working}>{working ? "Saving…" : "Create record"}</button></div></form>}
      <section className="panel intelligence-admin-panel">
        <div className="intelligence-admin-toolbar"><label className="history-search"><Search size={15} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search wallet, entity, source, or tag…" aria-label="Search intelligence records" /></label><label className="history-filter">Chain<select value={query.chain} onChange={(event) => setFilter("chain", event.target.value)}><option value="">All chains</option><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select></label><label className="history-filter">Category<select value={query.category} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label className="history-filter">Risk<select value={query.riskLevel} onChange={(event) => setFilter("riskLevel", event.target.value)}><option value="">All levels</option>{riskLevels.map((value) => <option key={value}>{value}</option>)}</select></label><label className="intelligence-inactive-filter"><input type="checkbox" checked={query.includeInactive === "true"} onChange={(event) => setFilter("includeInactive", String(event.target.checked))} /> Include inactive</label><button className="icon-button" onClick={() => void loadRecords()} aria-label="Refresh records" disabled={status === "loading"}><RefreshCw size={14} className={status === "loading" ? "spin" : ""} /></button></div>
        <div className="history-summary"><span>{meta ? `${meta.total.toLocaleString()} records` : "Records"}</span><span>{status === "loading" ? "Loading intelligence records…" : status === "ready" ? "Changes apply to the shared directory" : "Records unavailable"}</span></div>
        {status === "loading" && <div className="history-state"><RefreshCw className="spin" size={19} /> Loading intelligence records…</div>}
        {status === "error" && <div className="history-state"><ShieldAlert size={23} /><h2>Could not load records</h2><p>{error}</p><button className="primary-button" onClick={() => void loadRecords()}><RefreshCw size={14} /> Retry</button></div>}
        {status === "ready" && records.length === 0 && <div className="history-state"><ShieldAlert size={23} /><h2>{filtersActive ? "No records match these filters" : "No intelligence records yet"}</h2><p>{filtersActive ? "Adjust the search or filters and try again." : "Create a manually reviewed record or add records through an approved ingestion source."}</p></div>}
        {status === "ready" && records.length > 0 && <div className="users-table-scroll"><table className="intelligence-admin-table"><thead><tr><th>ENTITY / WALLET</th><th>CHAIN</th><th>CATEGORY</th><th>RISK</th><th>SOURCE</th><th>CONFIDENCE</th><th>STATUS</th><th /></tr></thead><tbody>{records.map((record) => <tr key={record._id}><td><div className="intelligence-entity"><b>{record.entityName || record.address}</b><small>{record.address}</small>{record.description && <span>{record.description}</span>}</div></td><td>{record.chain}</td><td>{record.category}</td><td><span className={`risk-pill risk-${record.riskLevel.toLowerCase()}`}><span />{record.riskLevel}</span></td><td><span>{record.sourceName}</span>{record.sourceUrl && <a className="intelligence-source-link" href={record.sourceUrl} target="_blank" rel="noreferrer noopener" aria-label="Open evidence source"><ExternalLink size={12} /></a>}</td><td>{Math.round(record.confidence * 100)}%</td><td><span className={`job-status ${record.isActive ? "job-succeeded" : "job-failed"}`}><i />{record.isActive ? "ACTIVE" : "INACTIVE"}</span></td><td><button className="secondary-button users-save" onClick={() => openEditor(record)}>Edit</button></td></tr>)}</tbody></table></div>}
        {status === "ready" && records.length > 0 && <div className="directory-pagination"><span>Page {meta?.page || query.page} of {Math.max(1, meta?.pages || 1)}</span><div><button disabled={query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={13} /> Previous</button><button disabled={!meta || query.page >= meta.pages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Next <ArrowRight size={13} /></button></div></div>}
      </section>
    </>}
    {editing && <div className="intelligence-modal-backdrop"><form className="panel intelligence-editor intelligence-modal" onSubmit={updateRecord}><div className="panel-heading"><div><h2>Edit intelligence record</h2><p>{editing.address} · {editing.chain}</p></div><button type="button" className="icon-button" aria-label="Close editor" onClick={() => setEditing(null)}><X size={16} /></button></div><RecordFields value={editing} onChange={setEditing} editing /><div className="intelligence-form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={working || editing.isActive === false && !editing.confirmDeactivate}>{working ? "Saving…" : "Save changes"}</button></div></form></div>}
  </div></main></div>;
}

export default function AdminIntelligencePage() {
  return <AuthGate><AdminIntelligenceView /></AuthGate>;
}
