"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Bell, ChevronDown, Clock3,
  Compass, FileSearch2, Fingerprint, History, LayoutDashboard, Menu, MoreHorizontal,
  LogOut, Settings2, ShieldCheck, ShieldEllipsis, SlidersHorizontal, UsersRound,
  Wallet, X,
} from "lucide-react";
import { getCurrentUser, getDashboardSummary, logoutAccount } from "../services/api";
import { formatDateIST, formatDateTimeIST } from "../utils/date-time";

const riskLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const riskColors = { CRITICAL: "#ff536b", HIGH: "#ff8b62", MEDIUM: "#e8b64f", LOW: "#51c89a", UNKNOWN: "#8190a8" };
const navigation = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, { label: "Screen wallet", href: "/screen", icon: FileSearch2 }, { label: "Investigations", href: "/investigate", icon: Compass }] },
  { title: "Intelligence", items: [{ label: "Directory", href: "/directory", icon: Fingerprint }, { label: "Screening history", href: "/history", icon: Clock3 }] },
  { title: "Workspace", items: [
    { label: "Data ingestion", href: "/admin/ingestion", icon: Activity, roles: ["ADMIN"] },
    { label: "Intelligence records", href: "/admin/intelligence", icon: ShieldEllipsis, roles: ["ADMIN"] },
    { label: "Provider setup", href: "/admin/providers", icon: Activity, roles: ["ADMIN"] },
    { label: "Team & access", href: "/admin", icon: UsersRound, roles: ["ADMIN"] },
    { label: "Settings", href: "/settings", icon: Settings2 },
  ] },
];

function RiskPill({ verdict }) {
  const value = riskLevels.includes(verdict) ? verdict : "UNKNOWN";
  return <span className={`risk-pill risk-${value.toLowerCase()}`}><span />{value}</span>;
}

function initials(name) {
  return String(name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function formatDateTime(value) {
  return formatDateTimeIST(value);
}

function sourceActivity(source) {
  const status = sourceLabel(source.status);
  const freshness = source.freshness && source.freshness !== "UNKNOWN" ? ` · ${source.freshness.toLowerCase()}` : " · freshness unknown";
  return `${status}${source.lastUpdatedAt ? ` · applied ${formatDateTime(source.lastUpdatedAt)}` : ""}${source.sourceGeneratedAt ? ` · source ${formatDateTime(source.sourceGeneratedAt)}` : ""}${freshness}`;
}

function formatDate(value) {
  return formatDateIST(`${value}T12:00:00+05:30`);
}

function sourceLabel(status) {
  return ({ LIVE: "Live", MOCK: "Fixture", UNAVAILABLE: "Unavailable", SUCCEEDED: "Synced", DRY_RUN: "Dry run", PARTIAL: "Partial", NOT_SYNCED: "Not synced", FAILED: "Failed", RUNNING: "Running" })[status] || status || "Unknown";
}

function statusClass(status) {
  if (["LIVE", "SUCCEEDED"].includes(status)) return "sync-ok";
  if (["MOCK", "PARTIAL", "DRY_RUN", "RUNNING"].includes(status)) return "sync-warn";
  return "sync-off";
}

export function Sidebar({ open, onClose, user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [resolvedUser, setResolvedUser] = useState(user || null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    if (user) {
      setResolvedUser(user);
      return undefined;
    }
    let current = true;
    getCurrentUser().then((response) => {
      if (current) setResolvedUser(response?.user || null);
    }).catch(() => {
      if (current) setResolvedUser(null);
    });
    return () => { current = false; };
  }, [user]);

  async function signOut() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logoutAccount();
      onClose?.();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error.message || "Could not end this session. Try again.");
      setLoggingOut(false);
    }
  }

  const activeUser = user || resolvedUser;
  const displayName = activeUser?.name || activeUser?.username || "Signed-in account";
  const visibleNavigation = navigation.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(activeUser?.role)),
  })).filter((group) => group.items.length > 0);
  return <>
    <div className={`sidebar-backdrop ${open ? "visible" : ""}`} onClick={onClose} />
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <Link href="/dashboard" className="brand mb-4" onClick={onClose}>
        <span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.3} /></span>
        <span className="brand-name">chain<span>guard</span><small>RISK INTELLIGENCE</small></span>
      </Link>
      <div className="sidebar-scroll">
        {visibleNavigation.map((group) => <div className="nav-group" key={group.title}>
          <p className="nav-heading">{group.title}</p>
          {group.items.map(({ label, href, icon: Icon }) => <Link href={href} key={href} onClick={onClose} className={`nav-link ${pathname === href || href !== "/admin" && pathname.startsWith(`${href}/`) ? "active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}
        </div>)}
      </div>
      <div className="sidebar-bottom">
        {/* <div className="plan-card"><div className="plan-head"><span><ShieldEllipsis size={14} /> Local workspace</span><span className="plan-dot" /></div><p>Screening activity</p><small>Counts reflect your saved records</small></div> */}
        <Link href="/profile" className="profile-switch" onClick={onClose}><span className="profile-avatar">{initials(displayName)}</span><span className="profile-name"><b>{displayName}</b><small>{activeUser?.role || "Account"}</small></span></Link>
        <button className="sidebar-logout" type="button" onClick={() => void signOut()} disabled={loggingOut}><LogOut size={15} /><span>{loggingOut ? "Signing out…" : "Sign out"}</span></button>
        {logoutError && <small className="sidebar-logout-error" role="alert">{logoutError}</small>}
      </div>
    </aside>
  </>;
}

export function Header({ onMenu, user }) {
  const pathname = usePathname();
  const router = useRouter();
  const pageName = pathname === "/dashboard" ? "Dashboard" : pathname === "/investigate" ? "Investigations" : pathname.startsWith("/history/") ? "Saved screening" : pathname.startsWith("/directory/") ? "Intelligence record" : pathname.startsWith("/investigate/") ? "Investigation graph" : pathname.split("/").filter(Boolean).at(-1)?.replace(/^./, (letter) => letter.toUpperCase()) || "Dashboard";
  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (pathname === "/screen") {
          window.dispatchEvent(new window.Event("chainguard:focus-wallet"));
        } else {
          window.sessionStorage.setItem("chainguard:focus-wallet", "true");
          router.push("/screen");
        }
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [pathname, router]);
  return <header className="topbar">
    <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
    <div className="breadcrumb"><span>Workspace</span><span className="crumb-sep">/</span><b>{pageName}</b></div>
    <div className="topbar-actions">
      <Link href="/history" className="icon-button notification" aria-label="View recent activity">
      <History size={18} /></Link><span className="top-divider" />
      <Link href="/profile" className="top-profile" aria-label={`Profile: ${user?.name || user?.username || "account"}`}>
      <span className="profile-avatar small">{initials(user?.name || user?.username)}</span>
      {/* <ChevronDown size={14} /> */}
      </Link>
      </div>
  </header>;
}

function RiskChart({ daily = [] }) {
  const maximum = Math.max(1, ...daily.map((row) => row.total));
  const dateIndices = [0, 7, 14, 21, 27].filter((index) => daily[index]);
  return <div className="chart-wrap">
    <div className="chart-y-labels"><span>{maximum}</span><span>{Math.round(maximum * .75)}</span><span>{Math.round(maximum * .5)}</span><span>{Math.round(maximum * .25)}</span><span>0</span></div>
    <div className="chart-main"><div className="chart-grid"><i /><i /><i /><i /><i /></div><div className="bar-chart" aria-label="Screening volume over the last 28 days">{daily.map((row) => <div key={row.date} className="bar-column" title={`${row.date}: ${row.total} screenings, ${row.highRisk} high risk`}><i style={{ height: `${Math.max(row.total ? 4 : 0, row.total / maximum * 100)}%` }} /><i style={{ height: `${row.highRisk / maximum * 100}%` }} /></div>)}</div><div className="chart-x-labels">{dateIndices.map((index) => <span key={daily[index].date}>{formatDate(daily[index].date)}</span>)}</div></div>
  </div>;
}

function Donut({ distribution, total }) {
  const segments = riskLevels.map((level) => ({ level, count: distribution[level] || 0 })).filter((item) => item.count > 0);
  let offset = 0;
  const stops = segments.map(({ level, count }) => {
    const from = offset;
    offset += count / total * 100;
    return `${riskColors[level]} ${from}% ${offset}%`;
  });
  return <div className="donut" role="img" aria-label={total ? `Risk distribution for ${total} saved screenings` : "No saved screening data"} style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#263346 0% 100%)" }}><div><b>{total.toLocaleString()}</b><small>Total</small></div></div>;
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardSummary(), getCurrentUser()]).then(([data, currentUser]) => {
      if (!active) return;
      setSummary(data);
      setUser(currentUser?.user || null);
      setError("");
    }).catch((requestError) => {
      if (active) setError(requestError.message || "Dashboard data is unavailable.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const distribution = summary?.distribution || Object.fromEntries(riskLevels.map((level) => [level, 0]));
  const metrics = summary?.metrics || { screenings: 0, highRisk: 0, uniqueWallets: 0, configuredSources: 0, sourceCount: 0 };
  const recent = summary?.recent || [];
  const daily = summary?.daily || [];
  const sources = summary?.sources || [];
  const greeting = user?.name?.split(/\s+/)[0] || user?.username || "there";
  const total = metrics.screenings || 0;
  const highRiskShare = total ? (metrics.highRisk / total * 100).toFixed(1) : "0.0";
  const chartTotal = useMemo(() => daily.reduce((sum, row) => sum + row.total, 0), [daily]);

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={user} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} user={user} /><div className="page-content">
    {error && <div className="demo-banner"><AlertTriangle size={15} /><b>DATA UNAVAILABLE</b><span>{error}</span><button onClick={() => window.location.reload()} aria-label="Retry dashboard data"><ArrowRight size={14} /></button></div>}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {formatDateIST(new Date()).toUpperCase()}</div><h1>Welcome{user ? `, ${greeting}` : ""} <span>✳</span></h1><p>Here&apos;s your risk intelligence overview for today.</p></div><Link className="primary-button" href="/screen"><FileSearch2 size={16} /> Screen a wallet <span className="button-shortcut">⌘ K</span></Link></div>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Total screenings</span><span className="metric-icon blue"><FileSearch2 size={17} /></span></div><div className="metric-value">{loading ? "—" : total.toLocaleString()}</div><div className="metric-foot">Last 28 days</div></article>
      <article className="metric-card"><div className="metric-top"><span>High risk detected</span><span className="metric-icon red"><AlertTriangle size={17} /></span></div><div className="metric-value">{loading ? "—" : metrics.highRisk.toLocaleString()}</div><div className="metric-foot">{loading ? "" : `${highRiskShare}% of saved screenings`}</div></article>
      <article className="metric-card"><div className="metric-top"><span>Wallets screened</span><span className="metric-icon violet"><Wallet size={17} /></span></div><div className="metric-value">{loading ? "—" : metrics.uniqueWallets.toLocaleString()}</div><div className="metric-foot">Unique chain and wallet pairs · 28 days</div></article>
      <article className="metric-card"><div className="metric-top"><span>Configured sources</span><span className="metric-icon green"><Activity size={17} /></span></div><div className="metric-value">{loading ? "—" : `${metrics.configuredSources} / ${metrics.sourceCount}`}</div><div className="metric-foot">Connected providers and registered feeds</div></article>
    </section>
    <section className="content-grid">
      <article className="panel volume-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>Screening activity</h2><span className="subtle-live"><i /> {loading ? "LOADING" : "SAVED DATA"}</span></div><p>Volume and high risk findings over time</p></div><span className="select-button"><SlidersHorizontal size={14} /> Last 28 days</span></div><RiskChart daily={daily} /><div className="chart-legend"><span><i className="legend-blue" /> Total screenings <b>{loading ? "—" : chartTotal.toLocaleString()}</b></span><span><i className="legend-red" /> High risk <b>{loading ? "—" : metrics.highRisk.toLocaleString()}</b></span><span className="chart-note">IST dates</span></div></article>
      <article className="panel distribution-panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>Saved screenings by risk level</p></div><span className="more-button" aria-hidden="true"><MoreHorizontal size={19} /></span></div><div className="distribution-body"><Donut distribution={distribution} total={total} /><div className="risk-legend">{riskLevels.map((level) => <div key={level}><i className={`risk-dot ${level.toLowerCase()}-dot`} /><span>{level[0] + level.slice(1).toLowerCase()}</span><b>{loading ? "—" : (distribution[level] || 0).toLocaleString()}</b><small>{total ? `${((distribution[level] || 0) / total * 100).toFixed(1)}%` : "0%"}</small></div>)}</div></div><div className="distribution-foot"><ShieldEllipsis size={14} /> {total ? "Risk labels reflect saved screening results" : "No saved screening results yet"}</div></article>
    </section>
    <section className="content-grid lower-grid">
      <article className="panel recent-panel"><div className="panel-heading"><div><h2>Recent screenings</h2><p>Your latest saved wallet screenings</p></div><Link href="/history" className="text-link">View all <ArrowRight size={14} /></Link></div><div className="table-scroll"><table><thead><tr><th>WALLET</th><th>NETWORK</th><th>RISK LEVEL</th><th>SCORE</th><th>SCREENED (IST)</th><th /></tr></thead><tbody>{recent.map((item) => <tr key={item._id}><td><Link className="wallet-cell" href={`/history/${item._id}`}><span className="wallet-avatar">{initials(item.chain)}</span><span><b>{item.address}</b><small>{item.providerStatus === "MOCK" ? "Fixture provider" : item.providerStatus === "UNAVAILABLE" ? "Provider unavailable" : "Saved screening"}</small></span></Link></td><td><span className={`network-tag network-${item.chain.toLowerCase()}`}><i />{item.chain}</span></td><td><RiskPill verdict={item.verdict} /></td><td><span className="score-cell">{item.riskScore ?? "—"}<small>{item.riskScore == null ? "" : "/100"}</small></span></td><td className="time-cell">{formatDateTime(item.screenedAt)}</td><td><Link className="row-more" href={`/history/${item._id}`} aria-label="Open saved screening"><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div><div className="table-footer"><span>{loading ? "Loading saved screenings…" : recent.length ? `Showing ${recent.length} recent of ${total.toLocaleString()} screenings` : "No screening activity in the last 28 days"}</span><Link href="/history">Browse history <ArrowRight size={13} /></Link></div></article>
      <article className="panel sources-panel"><div className="panel-heading"><div><h2>Data sources</h2><p>Provider status and latest activity</p></div><Link href="/admin/ingestion" className="icon-button more-button" aria-label="Manage data sources"><MoreHorizontal size={19} /></Link></div><div className="source-list">{sources.length ? sources.map((source) => <div className="source-row" key={source.id}><span className={`source-logo ${source.kind === "BLOCKCHAIN" ? "chain-source" : "intelligence-source"}`}>{source.kind === "BLOCKCHAIN" ? source.name.slice(0, 2) : "I"}</span><span className="source-info"><b>{source.name}</b><small>{source.note || source.kind}</small></span><span className="source-sync"><i className={statusClass(source.status)} /> {sourceActivity(source)}</span></div>) : <div className="source-empty">{loading ? "Loading source status…" : "No providers or intelligence feeds are configured."}</div>}</div><div className="source-demo"><AlertTriangle size={14} /><span>Intelligence freshness reflects the latest successful manual apply; overall screening coverage is still incomplete.</span></div></article>
    </section>
    <footer className="page-footer"><span>ChainGuard <i>·</i> Risk intelligence for the on-chain world</span><span><ShieldCheck size={13} /> {total ? "Saved screening data · source coverage may be incomplete" : "No saved screening data yet"}</span></footer>
  </div></main></div>;
}
