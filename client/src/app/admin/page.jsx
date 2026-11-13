"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Search, ShieldAlert, ShieldCheck, ShieldX, UsersRound } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { getAdminUsers, getCurrentUser, updateAdminUser } from "../../services/api";
import { formatDateTimeIST as formatDate } from "../../utils/date-time";

function AdminUsersView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [queryText, setQueryText] = useState("");
  const [query, setQuery] = useState({ q: "", role: "", status: "", page: 1, limit: 25 });
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => current.q === queryText.trim() && current.page === 1 ? current : { ...current, q: queryText.trim(), page: 1 }), 250);
    return () => clearTimeout(timer);
  }, [queryText]);

  const loadUsers = useCallback(async () => {
    setStatus("loading");
    setError("");
    setForbidden(false);
    try {
      const [session, response] = await Promise.all([getCurrentUser(), getAdminUsers(query)]);
      setCurrentUser(session.user);
      const records = response.data || [];
      setUsers(records);
      setMeta(response.meta || null);
      setDrafts(Object.fromEntries(records.map((user) => [user.id, { role: user.role, status: user.status }])));
      setStatus("ready");
    } catch (requestError) {
      if (requestError.status === 403) {
        setForbidden(true);
        setStatus("ready");
        return;
      }
      setError(requestError.message || "User access data is unavailable.");
      setStatus("error");
    }
  }, [query]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  function updateDraft(userId, key, value) {
    setDrafts((current) => ({ ...current, [userId]: { ...current[userId], [key]: value } }));
  }

  async function applyUpdate(userId, changes) {
    setWorkingId(userId);
    setError("");
    setConfirmation(null);
    try {
      const { user: updated } = await updateAdminUser(userId, changes);
      setUsers((current) => current.map((user) => user.id === userId ? updated : user));
      setDrafts((current) => ({ ...current, [userId]: { role: updated.role, status: updated.status } }));
    } catch (requestError) {
      setError(requestError.message || "User access could not be updated.");
    } finally {
      setWorkingId("");
    }
  }

  function requestUpdate(user) {
    const draft = drafts[user.id] || { role: user.role, status: user.status };
    const changes = {};
    if (draft.role !== user.role) changes.role = draft.role;
    if (draft.status !== user.status) changes.status = draft.status;
    if (Object.keys(changes).length === 0) return;
    if (["NOT_VERIFIED", "SUSPENDED"].includes(changes.status) || changes.role === "USER" && user.role === "ADMIN") {
      setConfirmation({ user, changes });
    } else {
      void applyUpdate(user.id, changes);
    }
  }

  const activeFilters = Boolean(query.role || query.status || query.q);
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={currentUser} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} user={currentUser} /><div className="page-content">
    {/* <div className="demo-banner"><ShieldCheck size={14} /><b>ADMIN ACCESS</b><span>Role and account changes are recorded in the audit log. You cannot change your own access.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE ADMIN</div><h1>Team &amp; access</h1><p>Review account status and assign workspace roles.</p></div><button className="secondary-button" onClick={() => void loadUsers()} disabled={status === "loading"}><RefreshCw size={14} className={status === "loading" ? "spin" : ""} /> Refresh</button></div>
    {forbidden && <section className="panel ingestion-access"><ShieldX size={24} /><h2>Administrator access required</h2><p>This page is limited to accounts with the ADMIN role.</p></section>}
    {error && status !== "error" && <div className="ingestion-inline-error" role="alert">{error}</div>}
    {!forbidden && <section className="panel users-panel">
      <div className="users-toolbar"><label className="history-search"><Search size={15} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search name, username, or email…" aria-label="Search users" /></label><label className="history-filter">Role<select value={query.role} onChange={(event) => setQuery((current) => ({ ...current, role: event.target.value, page: 1 }))}><option value="">All roles</option><option>USER</option><option>ADMIN</option></select></label><label className="history-filter">Status<select value={query.status} onChange={(event) => setQuery((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="">All statuses</option><option>NOT_VERIFIED</option><option>VERIFIED</option><option>SUSPENDED</option></select></label></div>
      <div className="history-summary"><span>{meta ? `${meta.total.toLocaleString()} accounts` : "Accounts"}</span><span>{status === "loading" ? "Loading accounts…" : status === "ready" ? "Access changes are audited" : "Account list unavailable"}</span></div>
      {status === "loading" && <div className="history-state"><RefreshCw className="spin" size={19} /> Loading workspace accounts…</div>}
      {status === "error" && <div className="history-state"><ShieldAlert size={23} /><h2>Could not load workspace accounts</h2><p>{error}</p><button className="primary-button" onClick={() => void loadUsers()}><RefreshCw size={14} /> Retry</button></div>}
      {status === "ready" && users.length === 0 && !forbidden && <div className="history-state"><UsersRound size={24} /><h2>{activeFilters ? "No accounts match these filters" : "No accounts found"}</h2><p>{activeFilters ? "Adjust the search or role/status filters." : "Accounts registered to this workspace will appear here."}</p></div>}
      {status === "ready" && users.length > 0 && <div className="users-table-scroll"><table className="users-table"><thead><tr><th>ACCOUNT</th><th>ROLE</th><th>STATUS</th><th>LAST SIGN-IN</th><th>CREATED</th><th /></tr></thead><tbody>{users.map((user) => {
        const isSelf = user.id === currentUser?.id;
        const draft = drafts[user.id] || { role: user.role, status: user.status };
        const changed = draft.role !== user.role || draft.status !== user.status;
        return <tr key={user.id}><td><div className="users-identity"><b>{user.name}</b><span>{user.email}{user.username ? ` · @${user.username}` : ""}</span>{isSelf && <small>Current administrator</small>}</div></td><td><select aria-label={`Role for ${user.name}`} value={draft.role} disabled={isSelf || workingId === user.id} onChange={(event) => updateDraft(user.id, "role", event.target.value)}><option>USER</option><option>ADMIN</option></select></td><td><select aria-label={`Status for ${user.name}`} value={draft.status} disabled={isSelf || workingId === user.id} onChange={(event) => updateDraft(user.id, "status", event.target.value)}><option>NOT_VERIFIED</option><option>VERIFIED</option><option>SUSPENDED</option></select></td><td>{formatDate(user.lastLoginAt)}</td><td>{formatDate(user.createdAt)}</td><td><button className="secondary-button users-save" disabled={isSelf || !changed || workingId === user.id} onClick={() => requestUpdate(user)}>{workingId === user.id ? "Saving…" : "Save"}</button></td></tr>;
      })}</tbody></table></div>}
      {status === "ready" && users.length > 0 && <div className="directory-pagination"><span>Page {meta?.page || query.page} of {Math.max(1, meta?.pages || 1)}</span><div><button disabled={query.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={13} /> Previous</button><button disabled={!meta || query.page >= meta.pages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Next <ArrowRight size={13} /></button></div></div>}
    </section>}
    {confirmation && <div className="history-confirm users-confirm"><span>Apply this access change to <b>{confirmation.user.name}</b>? Suspended accounts cannot sign in. The change will be written to the admin audit log.</span><div><button className="secondary-button" onClick={() => setConfirmation(null)}>Cancel</button><button className="history-confirm-delete" disabled={Boolean(workingId)} onClick={() => void applyUpdate(confirmation.user.id, confirmation.changes)}>Confirm change</button></div></div>}
  </div></main></div>;
}

export default function AdminUsersPage() {
  return <AuthGate><AdminUsersView /></AuthGate>;
}
