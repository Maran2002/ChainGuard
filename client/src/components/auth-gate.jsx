"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "../services/api";

const demoMode = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";

export default function AuthGate({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", error: "" });

  async function checkSession() {
    setState({ status: "loading", error: "" });
    try {
      await getCurrentUser();
      setState({ status: "authenticated", error: "" });
    } catch (error) {
      if (demoMode) {
        setState({ status: "demo", error: "" });
      } else if (error.status === 401) {
        router.replace("/login");
      } else {
        setState({ status: "error", error: error.message });
      }
    }
  }

  useEffect(() => { void checkSession(); }, []);

  if (state.status === "authenticated" || state.status === "demo") return children;
  if (state.status === "loading") {
    return <main className="auth-gate-state"><LoaderCircle className="spin" size={22} /><p>Checking your session…</p></main>;
  }
  return <main className="auth-gate-state"><div className="auth-gate-card"><AlertTriangle size={22} /><h1>Workspace unavailable</h1><p>{state.error || "Could not verify your session."}</p><div><button className="primary-button" onClick={() => void checkSession()}><RefreshCw size={14} /> Try again</button><Link href="/login" className="auth-gate-link">Sign in</Link></div><small><ShieldCheck size={13} /> Your session is checked by the ChainGuard API.</small></div></main>;
}
