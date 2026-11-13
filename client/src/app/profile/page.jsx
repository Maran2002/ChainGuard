"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Check, Clock3, KeyRound, LogOut, MonitorSmartphone, RefreshCw, Save,
  ShieldAlert, ShieldCheck, Trash2, UserRound,
} from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import {
  changeAccountPassword, deleteOwnAccount, getAuthSessions, getCurrentUser, logoutAccount,
  logoutAllSessions, revokeAuthSession, updateCurrentUser,
} from "../../services/api";
import { formatDateTimeIST as formatSessionDate } from "../../utils/date-time";

function ProfileContent() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [pendingRevokeId, setPendingRevokeId] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [deleteForm, setDeleteForm] = useState({ currentPassword: "", confirmation: "" });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      setSessions(await getAuthSessions());
    } catch (requestError) {
      setSessionsError(requestError.message);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentUser().then((data) => { setUser(data.user); setName(data.user.name); }).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { if (user) void loadSessions(); }, [user, loadSessions]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { user: updated } = await updateCurrentUser({ name: name.trim() });
      setUser(updated);
      setName(updated.name);
      setNotice("Your display name was saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordNotice("");
    try {
      await changeAccountPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordNotice("Password updated. Other active sessions were revoked.");
      await loadSessions();
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteOwnAccount(deleteForm);
      router.replace("/register");
      router.refresh();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logoutAccount();
      router.replace("/login");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOutAll() {
    setBusy(true);
    setError("");
    try {
      await logoutAllSessions();
      router.replace("/login");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(sessionId) {
    setRevokingId(sessionId);
    setSessionsError("");
    try {
      const result = await revokeAuthSession(sessionId);
      if (result.current) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setPendingRevokeId("");
    } catch (requestError) {
      setSessionsError(requestError.message);
    } finally {
      setRevokingId("");
    }
  }

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  return <div className="app-shell">
    <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
    <main className="main-panel">
      <Header onMenu={() => setMenuOpen(true)} user={user} />
      <div className="page-content">
        <div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div>
        <div className="page-heading"><div><h1>Profile &amp; security</h1><p>Manage your account details, password, and signed-in devices.</p></div></div>

        {user ? <div className="profile-security-layout">
          <section className="panel profile-panel">
            <div className="profile-card-avatar"><UserRound size={22} /></div>
            <h2>{user.name}</h2>
            <p>{user.email}{user.username ? ` · @${user.username}` : ""}</p>
            <form className="profile-edit-form" onSubmit={saveProfile}>
              <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
              <button className="primary-button" type="submit" disabled={saving || name.trim() === user.name}>{saving ? <><Save size={14} /> Saving…</> : <><Check size={14} /> Save profile</>}</button>
            </form>
            {notice && <div className="profile-notice" role="status">{notice}</div>}
            {error && <div className="profile-error" role="alert">{error}</div>}
            <div className="profile-meta"><span>Role</span><b>{user.role}</b><span>Status</span><b>{user.status}</b></div>

            <div className="profile-session-actions">
              <button className="secondary-button" onClick={signOut} disabled={busy}><LogOut size={15} /> {busy ? "Signing out…" : "Sign out"}</button>
              <button className="session-revoke-button" onClick={() => { setError(""); setConfirmAll(true); }} disabled={busy}><ShieldAlert size={14} /> Sign out all sessions</button>
            </div>
            {confirmAll && <div className="session-revoke-confirm" role="alert">
              <p>This revokes every active session for your account, including this one. You will need to sign in again.</p>
              <div><button className="secondary-button" onClick={() => setConfirmAll(false)} disabled={busy}>Cancel</button><button className="session-revoke-button confirm" onClick={() => void signOutAll()} disabled={busy}>{busy ? "Revoking sessions…" : "Confirm sign out everywhere"}</button></div>
            </div>}

            <div className="profile-sessions">
              <div className="profile-sessions-heading"><div><h3>Active sessions</h3><p>Devices currently signed in to your account.</p></div><span>{sessions.length}</span></div>
              {sessionsError && <div className="profile-error" role="alert">{sessionsError}<button className="sessions-retry" onClick={() => void loadSessions()}>Retry</button></div>}
              {sessionsLoading && <div className="profile-sessions-empty"><RefreshCw className="spin" size={14} /> Loading active sessions…</div>}
              {!sessionsLoading && sessions.length === 0 && !sessionsError && <div className="profile-sessions-empty">No active sessions found.</div>}
              {sessions.map((session) => <article className="profile-session-row" key={session.id}>
                <span className="session-device-icon"><MonitorSmartphone size={16} /></span>
                <div className="session-device-info"><b>{session.current ? "Current session" : session.userAgent || "Unknown device"}</b><small>{session.userAgent || "Device details unavailable"}</small><small><Clock3 size={11} /> Started {formatSessionDate(session.createdAt)} · Expires {formatSessionDate(session.expiresAt)}</small></div>
                {session.current ? <span className="session-current-badge">CURRENT</span> : pendingRevokeId === session.id ? <div className="session-row-confirm"><button onClick={() => setPendingRevokeId("")}>Cancel</button><button disabled={revokingId === session.id} onClick={() => void revokeSession(session.id)}>{revokingId === session.id ? "Revoking…" : "Confirm"}</button></div> : <button className="session-revoke-small" onClick={() => setPendingRevokeId(session.id)}>Revoke</button>}
              </article>)}
            </div>
          </section>

          <section className="panel profile-password-panel">
            <div className="profile-security-icon"><KeyRound size={19} /></div>
            <h2>Change password</h2>
            <p>Use a unique password with at least 12 characters. Changing it revokes your other active sessions.</p>
            <form className="password-change-form" onSubmit={updatePassword}>
              <label>Current password<input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField("currentPassword", event.target.value)} maxLength={72} required /></label>
              <label>New password<input type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField("newPassword", event.target.value)} minLength={12} maxLength={72} required /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => updatePasswordField("confirmPassword", event.target.value)} minLength={12} maxLength={72} required /></label>
              {passwordError && <div className="profile-error" role="alert">{passwordError}</div>}
              {passwordNotice && <div className="profile-notice" role="status">{passwordNotice}</div>}
              <button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? <><RefreshCw size={14} className="spin" /> Updating…</> : <><KeyRound size={14} /> Update password</>}</button>
            </form>
          </section>

          <section className="panel profile-password-panel">
            <div className="profile-security-icon"><Trash2 size={19} /></div>
            <h2>Delete account</h2>
            <p>This permanently removes your account, active sessions, and saved screening history. Your password is required to confirm.</p>
            <form className="password-change-form" onSubmit={deleteAccount}>
              <label>Current password<input type="password" autoComplete="current-password" value={deleteForm.currentPassword} onChange={(event) => setDeleteForm((current) => ({ ...current, currentPassword: event.target.value }))} maxLength={72} required /></label>
              <label>Type DELETE to confirm<input value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" required /></label>
              {deleteError && <div className="profile-error" role="alert">{deleteError}</div>}
              <button className="session-revoke-button confirm" type="submit" disabled={deleteBusy || deleteForm.confirmation !== "DELETE"}>{deleteBusy ? "Deleting account…" : "Permanently delete account"}</button>
            </form>
          </section>
        </div> : <section className="panel profile-panel"><h2>{error ? "Profile unavailable" : "Loading profile"}</h2><p>{error || "Checking your signed-in account…"}</p>{error && <button className="secondary-button" onClick={() => getCurrentUser().then((data) => { setUser(data.user); setName(data.user.name); setError(""); }).catch((requestError) => setError(requestError.message))}>Retry</button>}<Link className="primary-button" href="/login">Sign in to an account <ShieldCheck size={15} /></Link></section>}
      </div>
    </main>
  </div>;
}

export default function ProfilePage() {
  return <AuthGate><ProfileContent /></AuthGate>;
}
