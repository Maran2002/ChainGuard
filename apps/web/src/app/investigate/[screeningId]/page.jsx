"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, ChevronLeft, ChevronRight, Clock3, RefreshCw, RotateCcw, ShieldAlert, ZoomIn, ZoomOut } from "lucide-react";
import AuthGate from "../../../components/auth-gate";
import { Header, Sidebar } from "../../../components/dashboard";
import { getScreeningGraph, reinvestigateScreeningRecord } from "../../../services/api";
import { formatDateTimeIST as formatDate } from "../../../utils/date-time";

function compactAddress(value) {
  return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function riskColor(level) {
  return ({ CRITICAL: "#ed737d", HIGH: "#e58d72", MEDIUM: "#d9b66e", LOW: "#73c69e" })[level] || "#7c91ad";
}

function GraphCanvas({ graph }) {
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const layout = useMemo(() => {
    const root = graph.nodes.find((node) => node.kind === "ROOT");
    const hops = new Map(root ? [[root.address, 0]] : []);
    for (const edge of graph.edges) {
      if (!hops.has(edge.fromAddress) || edge.hop < hops.get(edge.fromAddress)) hops.set(edge.fromAddress, edge.hop);
      if (!hops.has(edge.toAddress) || edge.hop < hops.get(edge.toAddress)) hops.set(edge.toAddress, edge.hop);
    }
    const columns = new Map([[0, root ? [root] : []], [1, []], [2, []]]);
    for (const node of graph.nodes) {
      if (node.kind === "ROOT") continue;
      const hop = Math.min(2, hops.get(node.address) || 1);
      columns.get(hop).push(node);
    }
    const height = Math.max(340, Math.max(...[...columns.values()].map((column) => column.length)) * 104 + 60);
    const positions = new Map();
    for (const [hop, nodes] of columns) {
      const x = hop === 0 ? 125 : hop === 1 ? 450 : 790;
      const gap = height / (nodes.length + 1);
      nodes.forEach((node, index) => positions.set(node.address, { x, y: gap * (index + 1), node }));
    }
    return { height, positions };
  }, [graph]);

  function changeZoom(nextZoom) {
    setZoom(Math.max(50, Math.min(200, nextZoom)));
  }

  function pan(direction) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const distance = direction === "left" || direction === "right" ? viewport.clientWidth * 0.72 : viewport.clientHeight * 0.72;
    viewport.scrollBy({
      left: direction === "left" ? -distance : direction === "right" ? distance : 0,
      top: direction === "up" ? -distance : direction === "down" ? distance : 0,
      behavior: "smooth",
    });
  }

  function resetView() {
    setZoom(100);
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  return <div className="graph-viewer">
    <div className="graph-viewer-toolbar">
      <div className="graph-zoom-controls" role="group" aria-label="Graph zoom controls">
        <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 50} onClick={() => changeZoom(zoom - 25)}><ZoomOut size={14} /></button>
        <output aria-live="polite" aria-label="Current zoom level">{zoom}%</output>
        <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 200} onClick={() => changeZoom(zoom + 25)}><ZoomIn size={14} /></button>
        <button type="button" className="graph-reset-zoom" aria-label="Reset graph view to 100 percent" title="Reset to 100%" onClick={resetView}><RotateCcw size={13} /><span>100%</span></button>
      </div>
      <div className="graph-pan-controls" role="group" aria-label="Scroll graph">
        <button type="button" className="pan-up" aria-label="Scroll graph up" title="Scroll up" onClick={() => pan("up")}><ArrowUp size={14} /></button>
        <button type="button" className="pan-left" aria-label="Scroll graph left" title="Scroll left" onClick={() => pan("left")}><ArrowLeft size={14} /></button>
        <span aria-hidden="true" className="pan-center" />
        <button type="button" className="pan-right" aria-label="Scroll graph right" title="Scroll right" onClick={() => pan("right")}><ArrowRight size={14} /></button>
        <button type="button" className="pan-down" aria-label="Scroll graph down" title="Scroll down" onClick={() => pan("down")}><ArrowDown size={14} /></button>
      </div>
    </div>
    <div className="graph-canvas-scroll" id="transaction-graph-viewport" ref={viewportRef}>
    <svg className="graph-canvas" style={{ width: `${zoom}%`, minWidth: `${850 * zoom / 100}px` }} viewBox={`0 0 940 ${layout.height}`} role="img" aria-label={`Transaction graph with ${graph.nodes.length} wallet nodes and ${graph.edges.length} transfers`}>
    <defs><marker id="transfer-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7185a0" /></marker></defs>
    <text x="125" y="25" textAnchor="middle" className="graph-column-label">SCREENED WALLET</text><text x="450" y="25" textAnchor="middle" className="graph-column-label">DIRECT COUNTERPARTIES</text><text x="790" y="25" textAnchor="middle" className="graph-column-label">SECOND HOP</text>
    {graph.edges.map((edge) => {
      const from = layout.positions.get(edge.fromAddress);
      const to = layout.positions.get(edge.toAddress);
      if (!from || !to) return null;
      const middleX = (from.x + to.x) / 2;
      const middleY = (from.y + to.y) / 2;
      return <g key={edge.id} className={edge.dataLabel === "SIMULATED_FIXTURE" ? "graph-edge simulated" : "graph-edge"}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#transfer-arrow)" /><text x={middleX} y={middleY - 6} textAnchor="middle">{edge.amount} {edge.symbol}</text></g>;
    })}
    {[...layout.positions.values()].map(({ x, y, node }) => <g key={node.address} className={`graph-node ${node.kind === "ROOT" ? "root" : ""}`} transform={`translate(${x} ${y})`}><circle r={node.kind === "ROOT" ? 25 : 19} stroke={riskColor(node.riskLevel)} /><circle r="4" fill={riskColor(node.riskLevel)} className="graph-node-dot" /><text y={node.kind === "ROOT" ? 43 : 36} textAnchor="middle">{compactAddress(node.entityName || node.address)}</text>{node.riskLevel && <text y={node.kind === "ROOT" ? 57 : 50} textAnchor="middle" className="graph-node-risk">{node.riskLevel}</text>}</g>)}
  </svg></div>
  </div>;
}

function InvestigationView() {
  const transferPageSize = 25;
  const { screeningId } = useParams();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [depth, setDepth] = useState(1);
  const [graph, setGraph] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [expanding, setExpanding] = useState(false);
  const [transferPage, setTransferPage] = useState(0);

  const loadGraph = useCallback(async () => {
    setStatus("loading");
    setError("");
    setTransferPage(0);
    try {
      setGraph(await getScreeningGraph(screeningId, depth));
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }, [screeningId, depth]);

  useEffect(() => { void loadGraph(); }, [loadGraph]);

  const transferCount = graph?.edges.length || 0;
  const transferPageCount = Math.max(1, Math.ceil(transferCount / transferPageSize));
  const transferStart = transferCount === 0 ? 0 : transferPage * transferPageSize + 1;
  const transferEnd = Math.min(transferCount, (transferPage + 1) * transferPageSize);
  const visibleTransfers = graph?.edges.slice(transferPage * transferPageSize, (transferPage + 1) * transferPageSize) || [];

  async function loadSecondHop(requestedDepth = 2) {
    setExpanding(true);
    setError("");
    try {
      const response = await reinvestigateScreeningRecord(screeningId, requestedDepth);
      router.push(`/history/${response.screening._id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExpanding(false);
    }
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-panel"><Header onMenu={() => setMenuOpen(true)} /><div className="page-content">
    <Link href={`/history/${screeningId}`} className="text-link saved-back"><ArrowLeft size={14} /> Back to saved screening</Link>
    {/* <div className="demo-banner"><span className="demo-pulse" /><b>BOUNDED INVESTIGATION</b><span>Traversal is capped at two hops, 250 wallets, and 500 transfers.</span></div> */}
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> COUNTERPARTY ANALYSIS</div><h1>Transaction graph</h1><p>Explore stored transfers associated with this screening.</p></div><label className="graph-depth">Depth<select value={depth} onChange={(event) => setDepth(Number(event.target.value))}><option value={1}>1 hop</option><option value={2}>2 hops</option></select></label></div>
    {error && status !== "error" && <div className="history-error"><ShieldAlert size={15} />{error}</div>}
    {status === "error" && <div className="panel history-state"><ShieldAlert size={23} /><h2>Investigation unavailable</h2><p>{error}</p><button className="primary-button" onClick={() => void loadGraph()}><RefreshCw size={14} /> Retry</button></div>}
    {status === "loading" && <div className="panel history-state"><RefreshCw className="spin" size={19} /> Building bounded graph…</div>}
    {status === "ready" && graph && <>
      {graph.meta.snapshotAvailable === false && <div className="graph-unavailable"><ShieldAlert size={18} /><span>This older screening has no saved transaction snapshot. Run a fresh screening to collect a graph tied to its result.</span><button className="secondary-button" disabled={expanding} onClick={() => void loadSecondHop(graph.meta.screeningDepth || 1)}>{expanding ? "Screening…" : "Run fresh screening"}</button></div>}
      <div className="graph-summary"><span><b>{graph.meta.nodeCount}</b> wallets</span><span><b>{graph.meta.edgeCount}</b> transfers</span><span>Provider <b>{graph.meta.providerStatus}</b></span><span>Coverage <b>{graph.meta.coverageComplete ? "Complete" : "Incomplete"}</b></span><span>Screening depth <b>{graph.meta.screeningDepth}</b></span></div>
      {depth > graph.meta.screeningDepth && <div className="graph-truncation"><ShieldAlert size={14} /><span>This screening requested {graph.meta.screeningDepth}-hop data. Run a fresh 2-hop screening to request extended counterparties.</span><button disabled={expanding} onClick={() => void loadSecondHop()}>{expanding ? "Screening…" : "Run 2-hop screening"}</button></div>}
      {graph.meta.truncated && <div className="graph-truncation"><ShieldAlert size={14} /><span>{graph.meta.providerWindowTruncated ? "The provider response reached its transaction window limit; additional transfers may be omitted." : "The server graph traversal reached its node or edge budget; additional transfers may be omitted."}</span></div>}
      {graph.meta.snapshotAvailable && graph.edges.length === 0 && <div className="graph-unavailable"><ArrowRightLeft size={18} /><span>{graph.meta.providerStatus === "UNAVAILABLE" ? "No transaction history was collected because a blockchain provider was not configured." : graph.meta.providerStatus === "MOCK" ? "The mock provider returned no transaction fixtures for this wallet." : "No transfers were saved with this screening."}</span></div>}
      <section className="panel graph-panel"><div className="panel-heading"><div><h2>Wallet relationships</h2><p>Arrows show transfer direction. Dashed lines mark simulated fixture data.</p></div><button className="icon-button" aria-label="Refresh graph" onClick={() => void loadGraph()}><RefreshCw size={15} /></button></div>{graph.edges.length ? <GraphCanvas graph={graph} /> : <div className="graph-root-only"><div className="graph-root-mark" /><b>{compactAddress(graph.rootAddress)}</b><small>Screened wallet · {graph.chain}</small></div>}</section>
      <section className="panel graph-table-panel"><div className="panel-heading"><div><h2>Transfer table</h2><p>Accessible row view of the same graph edges.</p></div><span className="saved-evidence-count">{transferCount} rows</span></div>{transferCount === 0 ? <div className="saved-no-evidence"><span>No transfers to show for this provider result.</span></div> : <><div className="graph-table-scroll"><table className="graph-table"><thead><tr><th>FROM</th><th>TO</th><th>ASSET</th><th>AMOUNT</th><th>VALUE</th><th>HOP</th><th>TIME</th><th>DATA</th></tr></thead><tbody>{visibleTransfers.map((edge) => <tr key={edge.id}><td title={edge.fromAddress}>{compactAddress(edge.fromAddress)}</td><td title={edge.toAddress}>{compactAddress(edge.toAddress)}</td><td>{edge.symbol}</td><td>{edge.amount}</td><td>{edge.valueUsd == null ? "—" : `$${edge.valueUsd.toLocaleString()}`}</td><td>{edge.hop}</td><td>{formatDate(edge.blockTimestamp)}</td><td>{edge.dataLabel === "SIMULATED_FIXTURE" ? "Fixture" : "Source"}</td></tr>)}</tbody></table></div><div className="graph-table-pagination"><span>Showing {transferStart}–{transferEnd} of {transferCount} transfers</span>{transferPageCount > 1 && <nav aria-label="Transfer table pagination"><button type="button" aria-label="Previous transfer page" disabled={transferPage === 0} onClick={() => setTransferPage((page) => Math.max(0, page - 1))}><ChevronLeft size={14} /> Previous</button><span>Page {transferPage + 1} of {transferPageCount}</span><button type="button" aria-label="Next transfer page" disabled={transferPage + 1 >= transferPageCount} onClick={() => setTransferPage((page) => Math.min(transferPageCount - 1, page + 1))}>Next <ChevronRight size={14} /></button></nav>}</div></>}</section>
      <footer className="page-footer"><span>Transfers come from the saved screening snapshot. Wallet labels use the current intelligence directory and may change.</span>{graph.chain === "BSC" && <a href="https://nodereal.io/" target="_blank" rel="noreferrer">NodeReal data source</a>}<span><Clock3 size={13} /> Model {graph.meta.riskModelVersion}</span></footer>
    </>}
  </div></main></div>;
}

export default function InvestigationPage() {
  return <AuthGate><InvestigationView /></AuthGate>;
}
