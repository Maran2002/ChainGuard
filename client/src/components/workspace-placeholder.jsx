"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Compass, FileSearch2, Fingerprint, Settings2, UsersRound } from "lucide-react";
import { Header, Sidebar } from "./dashboard";

const icons = { directory: Fingerprint, investigate: Compass, history: FileSearch2, admin: UsersRound, settings: Settings2 };

export default function WorkspacePlaceholder({ title, eyebrow, description, icon }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = icons[icon] || Compass;
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <div className="demo-banner"><span className="demo-pulse" /><b>FOUNDATION BUILD</b><span>This workspace module is scheduled for a later implementation phase.</span></div>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>
    <div className="panel placeholder-panel"><div><Icon size={25} /><h2>Module foundation in progress</h2><p>This route is wired into the application shell. Its data workflow will be implemented against the authenticated API in the next phases.</p><Link className="primary-button" href="/screen" style={{ display: "inline-flex", marginTop: 17 }}>Start with wallet screening <ArrowRight size={14} /></Link></div></div>
  </div></main></div>;
}
