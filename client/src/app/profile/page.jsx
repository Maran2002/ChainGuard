"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import AuthGate from "../../components/auth-gate";
import { Header, Sidebar } from "../../components/dashboard";
import { getCurrentUser, logoutAccount } from "../../services/api";

function ProfileContent() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCurrentUser().then((data) => setUser(data.user)).catch((requestError) => setError(requestError.message));
  }, []);

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

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div><div className="page-heading"><div><h1>Profile &amp; session</h1><p>Account details and secure sign-out.</p></div></div>
    <section className="panel profile-panel"><div className="profile-card-avatar"><UserRound size={22} /></div>{user ? <><h2>{user.name}</h2><p>{user.email}</p><div className="profile-meta"><span>Role</span><b>{user.role}</b><span>Status</span><b>{user.status}</b></div><button className="secondary-button" onClick={signOut} disabled={busy}><LogOut size={15} /> {busy ? "Signing out…" : "Sign out"}</button></> : <><h2>Demo workspace</h2><p>{error || "Checking your account…"}</p><div className="demo-banner profile-demo"><span className="demo-pulse" /> This local workspace may be running without an account database.</div><Link className="primary-button" href="/login">Sign in to an account <ShieldCheck size={15} /></Link></>}</section>
  </div></main></div>;
}

export default function ProfilePage() {
  return <AuthGate><ProfileContent /></AuthGate>;
}
