"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell,
  ChevronDown, Clock3, Command, Compass, FileSearch2, Fingerprint,
  LayoutDashboard, Menu, MoreHorizontal, Search, Settings2, ShieldCheck,
  ShieldEllipsis, SlidersHorizontal, Sparkles, UsersRound, Wallet, X,
} from "lucide-react";

const navigation = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, { label: "Screen wallet", href: "/screen", icon: FileSearch2 }, { label: "Investigations", href: "/investigate", icon: Compass }] },
  { title: "Intelligence", items: [{ label: "Directory", href: "/directory", icon: Fingerprint }, { label: "Screening history", href: "/history", icon: Clock3 }] },
];

const screenings = [
  { address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", chain: "TRON", label: "Exchange hot wallet", verdict: "LOW", score: 12, time: "2 min ago", initials: "EX" },
  { address: "0x8f2a…c91d", chain: "ETHEREUM", label: "New counterparty", verdict: "MEDIUM", score: 48, time: "18 min ago", initials: "NC" },
  { address: "TQ3v…p7Kx", chain: "TRON", label: "Treasury review", verdict: "HIGH", score: 78, time: "42 min ago", initials: "TR" },
  { address: "0x21c4…0ba8", chain: "BSC", label: "Payment address", verdict: "LOW", score: 8, time: "1 hr ago", initials: "PA" },
];

const chartBars = [38, 51, 45, 67, 54, 78, 63, 58, 88, 74, 66, 94, 80, 72, 100, 84, 70, 91, 76, 62, 86, 69, 95, 79, 73, 88, 66, 82];

function RiskPill({ verdict }) {
  return <span className={`risk-pill risk-${verdict.toLowerCase()}`}><span />{verdict}</span>;
}

export function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  return <>
    <div className={`sidebar-backdrop ${open ? "visible" : ""}`} onClick={onClose} />
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <Link href="/dashboard" className="brand" onClick={onClose}>
        <span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.3} /></span>
        <span className="brand-name">chain<span>guard</span><small>RISK INTELLIGENCE</small></span>
      </Link>
      <Link href="/admin" className="workspace-switch" onClick={onClose}><span className="workspace-avatar">N</span><span className="workspace-text"><b>Northstar Capital</b><small>Workspace</small></span><ChevronDown size={15} /></Link>
      <div className="sidebar-scroll">
        {navigation.map((group) => <div className="nav-group" key={group.title}>
          <p className="nav-heading">{group.title}</p>
          {group.items.map(({ label, href, icon: Icon }) => <Link href={href} key={href} onClick={onClose} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Investigations" && <span className="nav-count">4</span>}</Link>)}
        </div>)}
        <div className="nav-group"><p className="nav-heading">Workspace</p><Link href="/admin" onClick={onClose} className={`nav-link ${pathname === "/admin" ? "active" : ""}`}><UsersRound size={17} /><span>Team & access</span></Link><Link href="/settings" onClick={onClose} className="nav-link"><Settings2 size={17} /><span>Settings</span></Link></div>
      </div>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-head"><span><Sparkles size={14} /> Analyst plan</span><span className="plan-dot" /></div><p>Screenings this month</p><div className="plan-meter"><span /></div><small><b>1,284</b> of 2,000</small></div>
        <Link href="/profile" className="profile-switch" onClick={onClose}><span className="profile-avatar">AM</span><span className="profile-name"><b>Alex Morgan</b><small>Risk analyst</small></span><MoreHorizontal size={19} /></Link>
      </div>
    </aside>
  </>;
}

export function Header({ onMenu }) {
  const pathname = usePathname();
  const pageName = pathname === "/dashboard" ? "Dashboard" : pathname.split("/").filter(Boolean).at(-1)?.replace(/^./, (letter) => letter.toUpperCase()) || "Dashboard";
  return <header className="topbar">
    <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
    <div className="breadcrumb"><span>Workspace</span><span className="crumb-sep">/</span><b>{pageName}</b></div>
    <div className="topbar-actions"><span className="chain-context"><span className="live-dot" /> All chains <ChevronDown size={14} /></span><Link href="/screen" className="global-search"><Search size={15} /><span>Search anything...</span><kbd><Command size={10} /> K</kbd></Link><Link href="/history" className="icon-button notification" aria-label="View recent activity"><Bell size={18} /><i /></Link><span className="top-divider" /><Link href="/profile" className="top-profile"><span className="profile-avatar small">AM</span><ChevronDown size={14} /></Link></div>
  </header>;
}

function RiskChart() {
  return <div className="chart-wrap">
    <div className="chart-y-labels"><span>120</span><span>90</span><span>60</span><span>30</span><span>0</span></div>
    <div className="chart-main"><div className="chart-grid"><i /><i /><i /><i /><i /></div><div className="bar-chart" aria-label="Screening volume over the last 28 days">{chartBars.map((height, index) => <div key={index} className={`bar-column ${index > 20 ? "bar-current" : ""}`}><i style={{ height: `${height}%` }} /><i style={{ height: `${Math.max(8, height * .34)}%` }} /></div>)}</div><div className="chart-x-labels"><span>Oct 14</span><span>Oct 21</span><span>Oct 28</span><span>Nov 04</span><span>Nov 10</span></div></div>
  </div>;
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoVisible, setDemoVisible] = useState(true);
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    {demoVisible && <div className="demo-banner"><span className="demo-pulse" /><b>DEMO WORKSPACE</b><span>Sample activity is simulated and does not represent live screening results.</span><button aria-label="Dismiss demo notice" onClick={() => setDemoVisible(false)}><X size={14} /></button></div>}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> TUESDAY, NOVEMBER 10, 2026</div><h1>Welcome back, Alex <span>✳</span></h1><p>Here&apos;s your risk intelligence overview for today.</p></div><Link className="primary-button" href="/screen"><FileSearch2 size={16} /> Screen a wallet <span className="button-shortcut">⌘ K</span></Link></div>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Total screenings</span><span className="metric-icon blue"><FileSearch2 size={17} /></span></div><div className="metric-value">1,284 <span className="trend positive"><ArrowUpRight size={13} /> 12.8%</span></div><div className="metric-foot">vs. previous 28 days</div><div className="metric-spark spark-blue"><svg viewBox="0 0 120 32" preserveAspectRatio="none"><path d="M0 26 C12 24 14 15 24 18 S39 25 49 15 S64 21 73 12 S88 19 98 8 S111 12 120 2" /></svg></div></article>
      <article className="metric-card"><div className="metric-top"><span>High risk detected</span><span className="metric-icon red"><AlertTriangle size={17} /></span></div><div className="metric-value">38 <span className="trend negative"><ArrowDownRight size={13} /> 4.2%</span></div><div className="metric-foot">2.9% of total screenings</div><div className="metric-spark spark-red"><svg viewBox="0 0 120 32" preserveAspectRatio="none"><path d="M0 7 C9 10 15 5 24 12 S38 9 46 18 S62 10 71 16 S84 23 94 14 S109 22 120 26" /></svg></div></article>
      <article className="metric-card"><div className="metric-top"><span>Wallets monitored</span><span className="metric-icon violet"><Wallet size={17} /></span></div><div className="metric-value">6,409 <span className="trend positive"><ArrowUpRight size={13} /> 8.1%</span></div><div className="metric-foot">Across 3 supported networks</div><div className="metric-spark spark-violet"><svg viewBox="0 0 120 32" preserveAspectRatio="none"><path d="M0 24 C10 22 16 25 25 17 S39 21 47 14 S59 18 69 9 S80 17 90 9 S108 12 120 2" /></svg></div></article>
      <article className="metric-card"><div className="metric-top"><span>Sources up to date</span><span className="metric-icon green"><Activity size={17} /></span></div><div className="metric-value">92<span className="value-unit">%</span> <span className="source-status"><span /> Operational</span></div><div className="metric-foot">11 of 12 sources reporting</div><div className="source-meter"><i /></div></article>
    </section>
    <section className="content-grid">
      <article className="panel volume-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>Screening activity</h2><span className="subtle-live"><i /> DEMO DATA</span></div><p>Volume and risk findings over time</p></div><span className="select-button"><SlidersHorizontal size={14} /> Last 28 days</span></div><RiskChart /><div className="chart-legend"><span><i className="legend-blue" /> Total screenings <b>1,284</b></span><span><i className="legend-red" /> High risk <b>38</b></span><span className="chart-note">Simulated period</span></div></article>
      <article className="panel distribution-panel"><div className="panel-heading"><div><h2>Risk distribution</h2><p>Screenings by risk level</p></div><span className="more-button" aria-hidden="true"><MoreHorizontal size={19} /></span></div><div className="distribution-body"><div className="donut" role="img" aria-label="Risk distribution: 4 percent critical, 9 percent high, 24 percent medium, 63 percent low"><div><b>1,284</b><small>Total</small></div></div><div className="risk-legend"><div><i className="risk-dot critical-dot" /><span>Critical</span><b>12</b><small>0.9%</small></div><div><i className="risk-dot high-dot" /><span>High</span><b>38</b><small>3.0%</small></div><div><i className="risk-dot medium-dot" /><span>Medium</span><b>306</b><small>23.8%</small></div><div><i className="risk-dot low-dot" /><span>Low</span><b>928</b><small>72.3%</small></div></div></div><div className="distribution-foot"><ShieldEllipsis size={14} /> All results are demo fixtures</div></article>
    </section>
    <section className="content-grid lower-grid">
      <article className="panel recent-panel"><div className="panel-heading"><div><h2>Recent screenings</h2><p>Your latest wallet investigations</p></div><Link href="/history" className="text-link">View all <ArrowRight size={14} /></Link></div><div className="table-scroll"><table><thead><tr><th>WALLET</th><th>NETWORK</th><th>RISK LEVEL</th><th>SCORE</th><th>SCREENED</th><th /></tr></thead><tbody>{screenings.map((item) => <tr key={item.address}><td><span className="wallet-cell"><span className="wallet-avatar">{item.initials}</span><span><b>{item.address}</b><small>{item.label}</small></span></span></td><td><span className={`network-tag network-${item.chain.toLowerCase()}`}><i />{item.chain}</span></td><td><RiskPill verdict={item.verdict} /></td><td><span className="score-cell">{item.score}<small>/100</small></span></td><td className="time-cell">{item.time}</td><td><span className="row-more" aria-hidden="true"><MoreHorizontal size={18} /></span></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing 4 of 1,284 screenings <span className="demo-inline">· simulated</span></span><Link href="/history">Browse history <ArrowRight size={13} /></Link></div></article>
      <article className="panel sources-panel"><div className="panel-heading"><div><h2>Data sources</h2><p>Coverage and latest sync</p></div><Link href="/admin" className="icon-button more-button" aria-label="Manage data sources"><MoreHorizontal size={19} /></Link></div><div className="source-list"><div className="source-row"><span className="source-logo ofac">OF</span><span className="source-info"><b>OFAC sanctions</b><small>U.S. Treasury</small></span><span className="source-sync"><i className="sync-ok" /> 4m ago</span></div><div className="source-row"><span className="source-logo tether">₮</span><span className="source-info"><b>Tether freeze list</b><small>Issuer source</small></span><span className="source-sync"><i className="sync-ok" /> 12m ago</span></div><div className="source-row"><span className="source-logo chainalysis">C</span><span className="source-info"><b>Scam intelligence</b><small>Community feed</small></span><span className="source-sync"><i className="sync-warn" /> 3h ago</span></div></div><div className="source-demo"><AlertTriangle size={14} /><span>Source activity is illustrative in demo mode.</span></div></article>
    </section>
    <footer className="page-footer"><span>ChainGuard <i>·</i> Risk intelligence for the on-chain world</span><span><ShieldCheck size={13} /> Data shown is simulated for demonstration</span></footer>
  </div></main></div>;
}
