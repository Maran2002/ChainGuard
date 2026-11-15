"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, FileSearch2, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { getCurrentUser, updateUserPreferences } from "../../services/api";

function SettingsView() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [defaultChain, setDefaultChain] = useState("TRON");
  const [defaultDepth, setDefaultDepth] = useState("1");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser().then(({ user: currentUser }) => {
      setUser(currentUser);
      setDefaultChain(currentUser.preferences?.defaultChain || "TRON");
      setDefaultDepth(String(currentUser.preferences?.defaultInvestigationDepth || 1));
      setStatus("ready");
    }).catch((requestError) => {
      setError(requestError.message || "Settings are unavailable.");
      setStatus("error");
    });
  }, []);

  async function savePreferences(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { user: updated } = await updateUserPreferences({ defaultChain, defaultInvestigationDepth: Number(defaultDepth) });
      setUser(updated);
      setNotice("Screening preferences saved.");
    } catch (requestError) {
      setError(requestError.message || "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={user} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} user={user} /><div className="page-content">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE</div><h1>Settings</h1><p>Choose the defaults used when you start a wallet screening.</p></div><Link href="/screen" className="primary-button"><FileSearch2 size={14} /> Screen a wallet</Link></div>
    {status === "loading" && <section className="panel settings-state"><RefreshCw size={18} className="spin" /> Loading your settings…</section>}
    {status === "error" && <section className="panel settings-state settings-error"><Settings2 size={20} /><h2>Settings unavailable</h2><p>{error}</p><button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={13} /> Retry</button></section>}
    {status === "ready" && <form className="panel user-settings-panel" onSubmit={savePreferences}>
      <div className="settings-section-heading"><span><Settings2 size={17} /></span><div><h2>Screening defaults</h2><p>These preferences are saved to your account and used when you open the screening form.</p></div></div>
      <div className="settings-fields"><label>Default blockchain<select value={defaultChain} onChange={(event) => setDefaultChain(event.target.value)}><option>TRON</option><option>ETHEREUM</option><option>BSC</option></select><small>Choose the network preselected for new screenings.</small></label><label>Default investigation depth<select value={defaultDepth} onChange={(event) => setDefaultDepth(event.target.value)}><option value="1">1 hop · Direct counterparties</option><option value="2">2 hops · Extended exposure</option></select><small>Depth is capped at 2 hops and still depends on available provider data.</small></label></div>
      {error && <div className="profile-error" role="alert">{error}</div>}{notice && <div className="profile-notice" role="status">{notice}</div>}
      <div className="settings-actions"><span><ShieldCheck size={13} /> Preferences apply to your account only.</span><button className="primary-button" type="submit" disabled={saving}>{saving ? <><RefreshCw size={13} className="spin" /> Saving…</> : <><Check size={13} /> Save preferences</>}</button></div>
    </form>}
  </div></main></div>;
}

export default function SettingsPage() {
  return <AuthGate><SettingsView /></AuthGate>;
}
