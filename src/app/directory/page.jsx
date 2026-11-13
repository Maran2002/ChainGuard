"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Download, Fingerprint, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { downloadIntelligenceCsv, getIntelligencePage } from "../../services/api";
import { formatDateTimeIST } from "../../utils/date-time";

const categories = ["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"];
const riskLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function DirectoryView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState({ q: "", chain: "", category: "", riskLevel: "", source: "", page: 1, limit: 20, sort: "newest" });
  const [result, setResult] = useState({ items: [], meta: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setQuery((current) => current.q === queryText.trim() && current.page === 1 ? current : ({ ...current, q: queryText.trim(), page: 1 })), 250);
    return () => clearTimeout(timeout);
  }, [queryText]);

  async function loadRecords() {
    setStatus("loading");
    setError("");
    try {
      const response = await getIntelligencePage(query);
      setResult({ items: response.data || [], meta: response.meta || null });
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }

  useEffect(() => { void loadRecords(); }, [query]);

  function setFilter(name, value) {
    setQuery((current) => ({ ...current, [name]: value, page: 1 }));
  }

  function resetFilters() {
    setQueryText("");
    setQuery({ q: "", chain: "", category: "", riskLevel: "", source: "", page: 1, limit: 20, sort: "newest" });
  }

  async function exportRecords() {
    setExporting(true);
    setExportError("");
    try {
      const exportQuery = {
        q: query.q,
        chain: query.chain,
        category: query.category,
        riskLevel: query.riskLevel,
        source: query.source,
        sort: query.sort,
      };
      const { blob } = await downloadIntelligenceCsv(exportQuery);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `chainguard-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setExportError(requestError.message || "The export could not be created.");
    } finally {
      setExporting(false);
    }
  }

  const activeFilters = [query.chain, query.category, query.riskLevel, query.source].some(Boolean);

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    {/* <div className="demo-banner"><span className="demo-pulse" /><b>CONFIGURED SOURCES</b><span>Only records loaded into this workspace appear here.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INTELLIGENCE</div><h1>Intelligence directory</h1><p>Search active records and inspect their evidence sources.</p></div><button className="secondary-button directory-export" onClick={() => void exportRecords()} disabled={exporting || status === "loading"}><Download size={14} />{exporting ? "Preparing CSV…" : "Export CSV"}</button></div>
    <section className="panel directory-panel">
      <div className="directory-search-row"><label className="directory-search"><Search size={16} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search address, entity, category, or source…" aria-label="Search intelligence records" />{queryText && <button type="button" onClick={() => setQueryText("")} aria-label="Clear search"><X size={14} /></button>}</label><label className="directory-sort">Sort<select value={query.sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">Recently added</option><option value="oldest">Oldest first</option><option value="confidence">Confidence</option></select><ChevronDown size={13} /></label></div>
      <div className="directory-filters"><label>Chain<select value={query.chain} onChange={(event) => setFilter("chain", event.target.value)}><option value="">All chains</option><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select></label><label>Category<select value={query.category} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Risk level<select value={query.riskLevel} onChange={(event) => setFilter("riskLevel", event.target.value)}><option value="">All levels</option>{riskLevels.map((level) => <option key={level}>{level}</option>)}</select></label><label>Source<input value={query.source} onChange={(event) => setFilter("source", event.target.value)} placeholder="Any source" /></label>{activeFilters && <button className="clear-filters" onClick={resetFilters}>Reset filters <X size={12} /></button>}</div>
      <div className="directory-summary"><span>{result.meta ? `${result.meta.total.toLocaleString()} records` : "Records"}</span><span>{status === "ready" ? "Source records only · no live provider lookup" : status === "loading" ? "Loading directory…" : "Directory unavailable"}</span></div>
      {exportError && <div className="directory-export-error" role="alert"><ShieldAlert size={14} /><span>{exportError}</span><button onClick={() => setExportError("")} aria-label="Dismiss export error"><X size={13} /></button></div>}
      {status === "loading" && <div className="directory-state"><RefreshCw className="spin" size={20} /><span>Loading intelligence records…</span></div>}
      {status === "error" && <div className="directory-state"><ShieldAlert size={23} /><h2>Could not load the directory</h2><p>{error}</p><button className="primary-button" onClick={() => void loadRecords()}><RefreshCw size={14} /> Retry</button></div>}
      {status === "ready" && result.items.length === 0 && <div className="directory-state"><Fingerprint size={24} /><h2>No records found</h2><p>{activeFilters || query.q ? "Try adjusting your search or filters." : "No intelligence records have been imported into this workspace yet."}</p>{(activeFilters || query.q) && <button className="secondary-button" onClick={resetFilters}>Clear search and filters</button>}</div>}
      {status === "ready" && result.items.length > 0 && <><div className="directory-table-wrap"><table className="directory-table"><thead><tr><th>WALLET / ENTITY</th><th>CHAIN</th><th>CATEGORY</th><th>RISK</th><th>SOURCE</th><th>CONFIDENCE</th><th>ADDED (IST)</th><th /></tr></thead><tbody>{result.items.map((record) => { const addedAt = record.ingestedAt; return <tr key={record._id}><td><Link className="directory-entity" href={`/directory/${record._id}`}><b>{record.entityName || record.address}</b><small>{record.entityName ? record.address : "Wallet address"}</small></Link></td><td>{record.chain}</td><td><span className="category-tag">{record.category}</span></td><td><span className={`risk-pill risk-${record.riskLevel.toLowerCase()}`}><span />{record.riskLevel}</span></td><td><span className="source-name">{record.sourceName}</span></td><td>{Math.round(record.confidence * 100)}%</td><td><time dateTime={addedAt}>{formatDateTimeIST(addedAt)}</time></td><td><Link href={`/directory/${record._id}`} aria-label={`Open ${record.entityName || record.address}`} className="directory-open"><ArrowRight size={15} /></Link></td></tr>; })}</tbody></table></div><div className="directory-pagination"><span>Page {result.meta?.page || query.page} of {Math.max(1, result.meta?.pages || 1)}</span><div><button disabled={query.page <= 1} onClick={() => setFilter("page", query.page - 1)}><ArrowLeft size={13} /> Previous</button><button disabled={!result.meta || query.page >= result.meta.pages} onClick={() => setFilter("page", query.page + 1)}>Next <ArrowRight size={13} /></button></div></div></>}
    </section>
  </div></main></div>;
}

export default function DirectoryPage() {
  return <AuthGate><DirectoryView /></AuthGate>;
}
