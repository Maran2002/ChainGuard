"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, FileSearch2, RefreshCw, Search, ShieldAlert, Trash2, X } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { deleteScreeningRecord, getScreeningHistory } from "../../services/api";
import { formatDateTimeIST as formatDate } from "../../utils/date-time";

function HistoryView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState({ q: "", chain: "", verdict: "", page: 1, limit: 20 });
  const [result, setResult] = useState({ items: [], meta: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setQuery((current) => current.q === searchText.trim() && current.page === 1 ? current : ({ ...current, q: searchText.trim(), page: 1 })), 250);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const loadHistory = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await getScreeningHistory(query);
      setResult({ items: response.data || [], meta: response.meta || null });
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }, [query]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  function setFilter(key, value) {
    setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function removeScreening(id) {
    setDeletingId(id);
    setError("");
    try {
      await deleteScreeningRecord(id);
      setPendingDelete("");
      if (result.items.length === 1 && query.page > 1) {
        setQuery((current) => ({ ...current, page: current.page - 1 }));
        return;
      }
      await loadHistory();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId("");
    }
  }

  const resetFilters = () => {
    setSearchText("");
    setQuery({ q: "", chain: "", verdict: "", page: 1, limit: 20 });
  };

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    {/* <div className="demo-banner"><span className="demo-pulse" /><b>ACCOUNT HISTORY</b><span>Saved screenings are visible only to the account that created them.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INTELLIGENCE</div><h1>Screening history</h1><p>Reopen prior results, run a fresh check, or remove an entry from your account.</p></div><Link href="/screen" className="primary-button"><FileSearch2 size={14} /> New screening</Link></div>

    <section className="panel history-panel">
      <div className="history-toolbar"><label className="history-search"><Search size={15} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search wallet address…" aria-label="Search screening history" />{searchText && <button type="button" aria-label="Clear search" onClick={() => setSearchText("")}><X size={13} /></button>}</label><label className="history-filter">Chain<select value={query.chain} onChange={(event) => setFilter("chain", event.target.value)}><option value="">All chains</option><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select></label><label className="history-filter">Verdict<select value={query.verdict} onChange={(event) => setFilter("verdict", event.target.value)}><option value="">All verdicts</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"].map((verdict) => <option key={verdict}>{verdict}</option>)}</select></label>{(query.chain || query.verdict || query.q) && <button className="clear-filters" onClick={resetFilters}>Reset <X size={12} /></button>}</div>
      <div className="history-summary"><span>{result.meta ? `${result.meta.total.toLocaleString()} screenings` : "Screenings"}</span><span>{status === "loading" ? "Loading account history…" : status === "ready" ? "Results saved to your account" : "History unavailable"}</span></div>
      {error && status !== "error" && <div className="history-error" role="alert"><ShieldAlert size={15} />{error}</div>}
      {status === "loading" && <div className="history-state"><RefreshCw className="spin" size={19} /> Loading screening history…</div>}
      {status === "error" && <div className="history-state"><ShieldAlert size={23} /><h2>Could not load your history</h2><p>{error}</p><button className="primary-button" onClick={() => void loadHistory()}><RefreshCw size={14} /> Retry</button></div>}
      {status === "ready" && result.items.length === 0 && <div className="history-state"><Clock3 size={24} /><h2>{query.q || query.chain || query.verdict ? "No screenings match these filters" : "No saved screenings yet"}</h2><p>{query.q || query.chain || query.verdict ? "Adjust the search or filters and try again." : "Once you run a screening with an account, its result will appear here."}</p>{(query.q || query.chain || query.verdict) ? <button className="secondary-button" onClick={resetFilters}>Clear filters</button> : <Link className="primary-button" href="/screen"><FileSearch2 size={14} /> Screen a wallet</Link>}</div>}
      {status === "ready" && result.items.length > 0 && <><div className="history-table-wrap"><table className="history-table"><thead><tr><th>WALLET</th><th>CHAIN</th><th>VERDICT</th><th>SCORE</th><th>PROVIDER</th><th>MATCHES</th><th>SCREENED</th><th /></tr></thead><tbody>{result.items.map((item) => <tr key={item._id}>
        <td><Link href={`/history/${item._id}`} className="history-address"><b>{item.address}</b>{item.transactionHash && <small>Transaction {item.transactionHash.slice(0, 12)}…</small>}</Link></td>
        <td>{item.chain}</td>
        <td><span className={`risk-pill risk-${item.verdict.toLowerCase()}`}><span />{item.verdict}</span></td>
        <td className="history-score">{item.riskScore ?? "—"}<small>{item.riskScore == null ? "" : "/100"}</small></td>
        <td><span className={`provider-tag provider-${item.providerStatus.toLowerCase()}`}>{item.providerStatus}</span></td>
        <td>{item.matchedRecords?.length || 0}</td>
        <td className="history-time">{formatDate(item.screenedAt)}</td>
        <td><div className="history-actions"><Link className="history-open" href={`/history/${item._id}`} aria-label={`Open screening for ${item.address}`}><ArrowRight size={14} /></Link><button className="history-delete" aria-label={`Delete screening for ${item.address}`} onClick={() => setPendingDelete(item._id)}><Trash2 size={13} /></button></div></td>
      </tr>)}</tbody></table></div><div className="directory-pagination"><span>Page {result.meta?.page || query.page} of {Math.max(1, result.meta?.pages || 1)}</span><div><button disabled={query.page <= 1} onClick={() => setFilter("page", query.page - 1)}><ArrowLeft size={13} /> Previous</button><button disabled={!result.meta || query.page >= result.meta.pages} onClick={() => setFilter("page", query.page + 1)}>Next <ArrowRight size={13} /></button></div></div></>}
      {pendingDelete && <div className="history-confirm"><span>Delete this screening from your account? It will no longer be available in your history.</span><div><button className="secondary-button" onClick={() => setPendingDelete("")}>Cancel</button><button className="history-confirm-delete" disabled={deletingId === pendingDelete} onClick={() => void removeScreening(pendingDelete)}>{deletingId === pendingDelete ? "Deleting…" : "Delete screening"}</button></div></div>}
    </section>
  </div></main></div>;
}

export default function ScreeningHistoryPage() {
  return <AuthGate><HistoryView /></AuthGate>;
}
