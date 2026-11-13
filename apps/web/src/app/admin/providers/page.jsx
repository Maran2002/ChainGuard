"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { getProviderSetup } from "../../../services/api";

function ProviderSetup() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await getProviderSetup()); }
    catch (failure) { setError(failure.status === 403 ? "Administrator access is required to view provider configuration." : failure.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <div className="page-heading"><div><h1>Blockchain providers</h1><p>Account setup and server configuration readiness.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button></div>
    {loading ? <div className="panel history-state">Loading provider setup…</div> : error ? <div className="panel history-state" role="alert"><ShieldAlert size={20} /><p>{error}</p></div> : data && <>
      <div className="saved-detail-grid">{data.providers.map((provider) => <section className="panel saved-card" key={provider.chain}>
        <div className="panel-heading"><div><h2>{provider.chain} · {provider.provider}</h2><p>Adapter: {provider.liveAdapterImplemented ? "Implemented" : "Unavailable"} · Status: {provider.adapterStatus} · Connectivity not checked</p></div></div>
        <div className="saved-coverage"><div><span>Endpoint</span><b>{provider.endpointPresent ? provider.endpointValid ? "Present; HTTPS format accepted" : "Present; expected a valid HTTPS endpoint" : "Not configured"}</b></div><div><span>Separate API key</span><b>{provider.separateKeyPresent ? "Present" : "Not configured"}</b></div><div><span>Endpoint setting</span><b className="saved-mono">{provider.endpointVariable}</b></div><div><span>Key setting</span><b className="saved-mono">{provider.keyVariable}</b></div>{provider.indexedHistoryProvider && <><div><span>Indexed history</span><b>{provider.indexedHistoryProvider} · {provider.indexedHistoryUsesSharedKey ? "Shared public key (limited)" : "Custom key configured"}</b></div><div><span>History key setting</span><b className="saved-mono">{provider.indexedHistoryCredentialVariable}</b></div></>}{provider.addressRiskProvider && <><div><span>Address risk check</span><b>{provider.addressRiskProvider} · {provider.addressRiskConfigured ? "Configured" : "Not configured"}</b></div><div><span>Risk key setting</span><b className="saved-mono">{provider.addressRiskCredentialVariable}</b></div></>}</div>
        <p className="saved-recommendation">{provider.chain === "TRON" ? "Create an API key in the TronGrid dashboard. Use https://api.trongrid.io as the mainnet base URL." : "Create an Alchemy app, enable this chain’s mainnet, and copy its HTTP endpoint from the Endpoints tab. The endpoint commonly contains the API key; a separate key field may therefore be blank."}</p>
        <a className="text-link" href={provider.setupUrl} target="_blank" rel="noopener noreferrer">Official setup instructions <ExternalLink size={13} /></a>
      </section>)}</div>
      <section className="panel saved-card"><h2>Where to save credentials</h2><p className="saved-recommendation">For local development, save provider credentials in the repository-root .env and restart the API. For Vercel, use the project’s Environment Variables. Keep keys out of client settings, public environment variables, and Git. This page reports which credentials are configured and keeps their values private.</p></section>
    </>}
  </div></main></div>;
}

export default function ProvidersPage() {
  return <AuthGate><ProviderSetup /></AuthGate>;
}
