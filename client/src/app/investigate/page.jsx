"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, FileSearch2, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { getScreeningHistory } from "../../services/api";
import { formatDateTimeIST as formatDate } from "../../utils/date-time";

function InvestigationsView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState({ q: "", chain: "", verdict: "", page: 1, limit: 20 });
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => current.q === searchText.trim() && current.page === 1 ? current : { ...current, q: searchText.trim(), page: 1 }), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await getScreeningHistory(query);
      setItems(response.data || []);
      setMeta(response.meta || null);
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message || "Investigation records are unavailable.");
      setStatus("error");
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  function setFilter(key, value) {
    setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function clearFilters() {
    setSearchText("");
    setQuery({ q: "", chain: "", verdict: "", page: 1, limit: 20 });
  }

  const filtered = Boolean(query.q || query.chain || query.verdict);
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> COUNTERPARTY ANALYSIS</div><h1>Investigations</h1><p>Open a saved screening to review its bounded transaction graph.</p></div><Link href="/screen" className="primary-button"><FileSearch2 size={14} /> Screen a wallet</Link></div>
    <section className="panel history-panel investigation-queue">
      <div className="history-toolbar"><label className="history-search"><Search size={15} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search wallet address…" aria-label="Search investigations" />{searchText && <button type="button" aria-label="Clear search" onClick={() => setSearchText("")}><X size={13} /></button>}</label><label className="history-filter">Chain<select value={query.chain} onChange={(event) => setFilter("chain", event.target.value)}><option value="">All chains</option><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select></label><label className="history-filter">Risk<select value={query.verdict} onChange={(event) => setFilter("verdict", event.target.value)}><option value="">All risk levels</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"].map((verdict) => <option key={verdict}>{verdict}</option>)}</select></label>{filtered && <button className="clear-filters" onClick={clearFilters}>Reset <X size={12} /></button>}</div>
      <div className="history-summary"><span>{meta ? `${meta.total.toLocaleString()} saved screenings` : "Saved screenings"}</span><span>{status === "loading" ? "Loading investigations…" : status === "ready" ? "Only your account records are shown" : "Investigation queue unavailable"}</span></div>
      {status === "error" && <div className="history-state"><ShieldAlert size={23} /><h2>Could not load investigations</h2><p>{error}</p><button className="primary-button" onClick={() => void load()}><RefreshCw size={14} /> Retry</button></div>}
      {status === "loading" && <div className="history-state"><RefreshCw className="spin" size={19} /> Loading saved screenings…</div>}
      {status === "ready" && items.length === 0 && <div className="history-state"><Compass size={25} /><h2>{filtered ? "No screenings match these filters" : "No investigations yet"}</h2><p>{filtered ? "Try another wallet address, chain, or risk level." : "Run a wallet screening to create a saved investigation. Its transaction graph will appear here."}</p>{filtered ? <button className="secondary-button" onClick={clearFilters}>Clear filters</button> : <Link href="/screen" className="primary-button"><FileSearch2 size={14} /> Screen a wallet</Link>}</div>}
      {status === "ready" && items.length > 0 && <div className="investigation-list">{items.map((item) => <article className="investigation-card" key={item._id}>
        <div className="investigation-card-main"><span className={`network-tag network-${item.chain.toLowerCase()}`}><i />{item.chain}</span><Link href={`/history/${item._id}`} className="investigation-address">{item.address}</Link><span className={`risk-pill risk-${item.verdict.toLowerCase()}`}><span />{item.verdict}</span></div>
        <div className="investigation-card-meta"><span>Score <b>{item.riskScore == null ? "Unknown" : `${item.riskScore}/100`}</b></span><span>Provider <b>{item.providerStatus}</b></span><span>{item.matchedRecords?.length || 0} evidence matches</span><span>{item.investigationDepth || 1}-hop data{item.transactionDataTruncated ? " · truncated" : ""}</span><time dateTime={item.screenedAt}>{formatDate(item.screenedAt)}</time></div>
        <div className="investigation-card-actions"><Link href={`/history/${item._id}`} className="text-link">Screening details <ArrowRight size={13} /></Link><Link href={`/investigate/${item._id}`} className="primary-button"><Compass size={14} /> Open graph</Link></div>
      </article>)}</div>}
      {status === "ready" && items.length > 0 && <div className="directory-pagination"><span>Page {meta?.page || query.page} of {Math.max(1, meta?.pages || 1)}</span><div><button disabled={query.page <= 1} onClick={() => setFilter("page", query.page - 1)}><ArrowLeft size={13} /> Previous</button><button disabled={!meta || query.page >= meta.pages} onClick={() => setFilter("page", query.page + 1)}>Next <ArrowRight size={13} /></button></div></div>}
    </section>
    <footer className="page-footer"><span>Graph results are limited to stored provider data and the screening’s requested depth.</span><span><Compass size={13} /> Max depth 2 hops</span></footer>
  </div></main></div>;
}

export default function InvestigationsPage() {
  return <AuthGate><InvestigationsView /></AuthGate>;
}
