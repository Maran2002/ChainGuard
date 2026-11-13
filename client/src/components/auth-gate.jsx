"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "../services/api";

const demoMode = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";

export default function AuthGate({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", error: "", title: "Workspace unavailable" });

  async function checkSession() {
    setState({ status: "loading", error: "", title: "Workspace unavailable" });
    try {
      await getCurrentUser();
      setState({ status: "authenticated", error: "" });
    } catch (error) {
      if (demoMode) {
        setState({ status: "demo", error: "" });
      } else if (error.status === 401) {
        router.replace("/login");
      } else {
        const title = error.status === 429
          ? "Request limit reached"
          : error.code === "DATABASE_UNAVAILABLE" || error.status === 503
          ? "Account services unavailable"
          : error.message === "ChainGuard API is unavailable. Start the server and try again."
            ? "API unavailable"
            : "Workspace unavailable";
        setState({ status: "error", error: error.message, title });
      }
    }
  }

  useEffect(() => { void checkSession(); }, []);

  if (state.status === "authenticated" || state.status === "demo") return children;
  if (state.status === "loading") {
    return <main className="auth-gate-state"><LoaderCircle className="spin" size={22} /><p>Checking your session…</p></main>;
  }
  return <main className="auth-gate-state"><div className="auth-gate-card"><AlertTriangle size={22} /><h1>{state.title}</h1><p>{state.error || "Could not verify your session."}</p><div><button className="primary-button" onClick={() => void checkSession()}><RefreshCw size={14} /> Try again</button><Link href="/login" className="auth-gate-link">Sign in</Link></div><small><ShieldCheck size={13} /> Your session is checked by the ChainGuard API.</small></div></main>;
}
