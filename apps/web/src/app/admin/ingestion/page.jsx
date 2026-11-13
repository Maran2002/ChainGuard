"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Check, Clock3, CloudDownload, ExternalLink, Play, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { getAdminAuditLogs, getIngestionJobs, getIngestionSources, getCurrentUser, runIntelligenceIngestion } from "../../../services/api";
import { formatDateTimeIST as formatDate } from "../../../utils/date-time";

function IngestionView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [workingSource, setWorkingSource] = useState("");
  const [lastDryRuns, setLastDryRuns] = useState({});
  const [confirmSource, setConfirmSource] = useState("");
  const [confirmApply, setConfirmApply] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadData = useCallback(async () => {
    setStatus("loading");
    setError("");
    setForbidden(false);
    try {
      const { user } = await getCurrentUser();
      if (user.role !== "ADMIN") {
        setForbidden(true);
        setStatus("ready");
        return;
      }
      const [sourceList, jobList, auditList] = await Promise.all([getIngestionSources(), getIngestionJobs(), getAdminAuditLogs()]);
      setSources(sourceList || []);
      setJobs(jobList || []);
      setAuditLogs(auditList || []);
      setStatus("ready");
    } catch (requestError) {
      if (requestError.status === 403) {
        setForbidden(true);
        setStatus("ready");
        return;
      }
      setError(requestError.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function runSource(source, dryRun) {
    setWorkingSource(source.id);
    setError("");
    setNotice(null);
    setConfirmSource("");
    setConfirmApply(false);
    try {
      const result = await runIntelligenceIngestion(source.id, { dryRun });
      if (dryRun) setLastDryRuns((current) => ({ ...current, [source.id]: { ...result, completedAt: new Date().toISOString() } }));
      else setLastDryRuns((current) => { const next = { ...current }; delete next[source.id]; return next; });
      setNotice({ sourceId: source.id, result });
      const jobList = await getIngestionJobs();
      setJobs(jobList || []);
      const auditList = await getAdminAuditLogs();
      setAuditLogs(auditList || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorkingSource("");
    }
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    {/* <div className="demo-banner"><span className="demo-pulse" /><b>CONTROLLED INGESTION</b><span>Only reviewed, registered adapters can retrieve source data.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE ADMIN</div><h1>Data ingestion</h1><p>Review source adapters, preview changes, and inspect recent ingestion runs.</p></div><button className="secondary-button" onClick={() => void loadData()} disabled={status === "loading"}><RefreshCw size={14} className={status === "loading" ? "spin" : ""} /> Refresh</button></div>

    {forbidden && <section className="panel ingestion-access"><ShieldX size={24} /><h2>Administrator access required</h2><p>This page is limited to accounts with the ADMIN role. Ask a workspace administrator to grant access.</p></section>}
    {status === "error" && <section className="panel ingestion-error"><AlertTriangle size={19} /><div><b>Ingestion service unavailable</b><p>{error}</p></div><button className="secondary-button" onClick={() => void loadData()}>Retry</button></section>}
    {notice && <div className={`ingestion-notice ${notice.result.dryRun ? "preview" : "applied"}`}><span>{notice.result.dryRun ? <CloudDownload size={16} /> : <Check size={16} />}</span><div><b>{notice.result.dryRun ? "Dry run completed" : "Source records applied"}</b><small>{notice.result.counts.fetched} fetched · {notice.result.counts.created} created · {notice.result.counts.updated} updated · {notice.result.counts.deactivated || 0} deactivated · {notice.result.counts.skipped} skipped · {notice.result.counts.failed} failed{notice.result.dryRun ? ` · ${notice.result.wouldDeactivate || 0} would be deactivated` : ""}</small></div></div>}
    {error && status !== "error" && <div className="ingestion-inline-error" role="alert">{error}</div>}

    {!forbidden && status === "ready" && <>
      <section className="panel ingestion-policy"><div className="policy-icon"><ShieldCheck size={18} /></div><div><b>Dry run first</b><p>Preview validates and deduplicates source records without changing the directory. Applying records is available only after a dry run in this session.</p></div><span className="policy-state">{sources.length ? "INGESTION ENABLED" : "NO SOURCES REGISTERED"}</span></section>

      <div className="ingestion-section-heading"><div><h2>Registered sources</h2><p>{sources.length ? `${sources.length} adapter${sources.length === 1 ? "" : "s"} configured` : "No source adapters are configured in this environment."}</p></div></div>
      {sources.length === 0 ? <section className="panel ingestion-empty"><div className="empty-icon"><Activity size={21} /></div><h3>Waiting for a reviewed source adapter</h3><p>Live ingestion stays unavailable until an adapter has a verified source, documented terms and attribution, and parser fixtures. The API will not fetch URLs supplied from this page.</p><span className="ingestion-doc-link">The adapter contract and local setup are documented in the project repository.</span></section> : <div className="ingestion-source-list">{sources.map((source) => {
        const dryRun = lastDryRuns[source.id];
        const isWorking = workingSource === source.id;
        return <article className="panel ingestion-source" key={source.id}>
          <div className="source-card-top"><span className="source-logo source-logo-admin"><Activity size={15} /></span><div className="source-info"><b>{source.name}</b><small>{source.id} · {source.updateCadence || "Cadence not specified"} · freshness target {source.freshnessMaxAgeHours ? `${source.freshnessMaxAgeHours}h` : "not set"}</small></div><span className="source-registered"><i /> Registered</span></div>
          {(() => {
            const lastApply = jobs.find((job) => job.sourceId === source.id && job.status === "SUCCEEDED" && !job.dryRun);
            const freshnessAt = source.freshnessUsesSourceTimestamp ? lastApply?.sourceGeneratedAt : lastApply?.completedAt;
            const freshness = !lastApply || !freshnessAt ? "UNKNOWN" : Date.now() - new Date(freshnessAt).getTime() <= (source.freshnessMaxAgeHours || 0) * 60 * 60 * 1000 ? "CURRENT" : "STALE";
            return <p className="saved-recommendation">Last successful apply: {lastApply ? formatDate(lastApply.completedAt || lastApply.startedAt) : "none recorded"}. {lastApply?.sourceGeneratedAt ? `Upstream snapshot generated: ${formatDate(lastApply.sourceGeneratedAt)}. ` : source.freshnessUsesSourceTimestamp ? "Upstream generation time is unavailable. " : ""}Data freshness: {freshness.toLowerCase()}{source.freshnessUsesSourceTimestamp ? " (based on upstream generation time)" : " (based on successful apply time)"}.</p>;
          })()}
          {(source.attributionUrl || source.termsUrl) && <div className="source-policy-links">{source.attributionUrl && <a href={source.attributionUrl} target="_blank" rel="noopener noreferrer">Attribution <ExternalLink size={11} /></a>}{source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noopener noreferrer">Terms <ExternalLink size={11} /></a>}</div>}
          <div className="source-card-actions"><button className="secondary-button" disabled={isWorking} onClick={() => void runSource(source, true)}>{isWorking ? <RefreshCw size={13} className="spin" /> : <CloudDownload size={14} />} Run dry run</button>{dryRun && <button className="primary-button" disabled={isWorking || dryRun.counts.failed > 0 || dryRun.counts.fetched === 0} title={dryRun.counts.failed > 0 ? "Resolve invalid source records and run another preview before applying." : dryRun.counts.fetched === 0 ? "An empty snapshot cannot be applied." : ""} onClick={() => { setConfirmSource(source.id); setConfirmApply(false); }}><Play size={13} /> Apply records</button>}</div>
          {dryRun && <div className="dry-run-summary"><Check size={13} /> Previewed {dryRun.counts.fetched} records at {formatDate(dryRun.completedAt)}{dryRun.sourceGeneratedAt ? ` · source generated ${formatDate(dryRun.sourceGeneratedAt)}` : ""}; {dryRun.counts.failed} invalid; {dryRun.wouldDeactivate || 0} existing records would be deactivated. This result is valid for this page session.</div>}
          {confirmSource === source.id && <div className="apply-confirm"><div><b>Apply records from {source.name}?</b><p>This will upsert validated items into the shared intelligence directory. The action creates an auditable ingestion job.</p></div><label><input type="checkbox" checked={confirmApply} onChange={(event) => setConfirmApply(event.target.checked)} /> I reviewed the source and want to apply its records.</label><div><button className="secondary-button" onClick={() => setConfirmSource("")}>Cancel</button><button className="primary-button" disabled={!confirmApply || isWorking} onClick={() => void runSource(source, false)}><Play size={13} /> Confirm apply</button></div></div>}
        </article>;
      })}</div>}

      <div className="ingestion-section-heading jobs-heading"><div><h2>Recent runs</h2><p>Latest source activity and record counts.</p></div><span className="jobs-refresh"><Clock3 size={13} /> Latest 30</span></div>
      <section className="panel ingestion-jobs-panel">{jobs.length === 0 ? <div className="jobs-empty"><Clock3 size={18} /><span>No ingestion runs recorded yet.</span></div> : <div className="ingestion-jobs-scroll"><table className="ingestion-jobs"><thead><tr><th>SOURCE</th><th>STATUS</th><th>MODE</th><th>FETCHED</th><th>CREATED</th><th>UPDATED</th><th>DEACTIVATED</th><th>SKIPPED</th><th>FAILED</th><th>STARTED</th><th>UPSTREAM GENERATED</th></tr></thead><tbody>{jobs.map((job) => <tr key={job._id}><td><b>{job.sourceName}</b><small>{job.sourceId}</small></td><td><span className={`job-status job-${job.status.toLowerCase()}`}><i />{job.status}</span></td><td>{job.dryRun ? "Dry run" : "Apply"}</td><td>{job.counts?.fetched ?? 0}</td><td>{job.counts?.created ?? 0}</td><td>{job.counts?.updated ?? 0}</td><td>{job.counts?.deactivated ?? 0}</td><td>{job.counts?.skipped ?? 0}</td><td>{job.counts?.failed ?? 0}</td><td>{formatDate(job.startedAt)}</td><td>{job.sourceGeneratedAt ? formatDate(job.sourceGeneratedAt) : "—"}</td></tr>)}</tbody></table></div>}</section>
      <div className="ingestion-section-heading jobs-heading"><div><h2>Admin audit log</h2><p>Recent privileged actions recorded for this workspace.</p></div><span className="jobs-refresh"><ShieldCheck size={13} /> Latest 30</span></div>
      <section className="panel ingestion-jobs-panel">{auditLogs.length === 0 ? <div className="jobs-empty"><ShieldCheck size={18} /><span>No administrative actions recorded yet.</span></div> : <div className="ingestion-jobs-scroll"><table className="ingestion-jobs audit-table"><thead><tr><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>STATUS</th><th>DETAIL</th><th>OCCURRED</th></tr></thead><tbody>{auditLogs.map((entry) => <tr key={entry._id}><td>{entry.actorType === "SYSTEM" ? "System bootstrap" : "Workspace admin"}</td><td>{entry.action.replaceAll("_", " ")}</td><td><b>{entry.targetType}</b><small>{entry.sourceId || entry.targetId}</small></td><td><span className={`job-status job-${entry.status.toLowerCase()}`}><i />{entry.status}</span></td><td>{entry.accessChange?.previousRole ? `${entry.accessChange.previousRole} → ${entry.accessChange.newRole}; ${entry.accessChange.previousStatus} → ${entry.accessChange.newStatus}` : entry.changedFields?.length ? entry.changedFields.join(", ") : entry.dryRun == null ? "—" : entry.dryRun ? "Dry run" : "Applied"}</td><td>{formatDate(entry.occurredAt)}</td></tr>)}</tbody></table></div>}</section>
      <footer className="page-footer"><span>Ingestion is manual and source-specific. No background refresh is configured.</span><span><ShieldCheck size={13} /> Source access follows documented terms</span></footer>
    </>}
  </div></main></div>;
}

export default function IngestionAdminPage() {
  return <AuthGate><IngestionView /></AuthGate>;
}
