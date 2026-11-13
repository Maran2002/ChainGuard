"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Fingerprint, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordReset, resetPasswordWithToken, verifyAccountEmail, verifyPasswordResetToken } from "../services/api";

function AuthFlowCard({ eyebrow, title, children }) {
  return <main className="auth-page">
    <div className="auth-glow" />
    <div className="auth-top"><Link href="/dashboard" className="brand auth-brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span className="brand-name">chain<span>guard</span><small>RISK INTELLIGENCE</small></span></Link><span className="auth-top-note"><span className="live-dot" /> SECURE WORKSPACE</span></div>
    <section className="auth-card">
      <div className="auth-icon"><Fingerprint size={21} /></div>
      <div className="auth-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children}
      <div className="auth-security"><ShieldCheck size={14} /> ChainGuard uses one-time, expiring links for account security.</div>
    </section>
    <footer className="auth-footer"><span>ChainGuard · Wallet risk intelligence</span><span>Read-only investigation platform</span></footer>
  </main>;
}

export function VerifyEmailFlow() {
  const verificationStarted = useRef(false);
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (verificationStarted.current) return;
    verificationStarted.current = true;
    const tokenFromLink = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!tokenFromLink) {
      setStatus("invalid");
      setMessage("This verification link is missing or invalid.");
      return;
    }
    setStatus("working");
    verifyAccountEmail(tokenFromLink).then(() => setStatus("verified")).catch((error) => {
      setStatus("invalid");
      setMessage(error.message || "This verification link is invalid or expired.");
    });
  }, []);

  return <AuthFlowCard eyebrow="EMAIL VERIFICATION" title={status === "verified" ? "Email verified" : status === "invalid" ? "Could not verify email" : "Verifying your email"}>
    {status === "checking" || status === "working" ? <div className="auth-flow-message"><p>Verifying your email link…</p></div> : null}
    {status === "verified" && <div className="auth-flow-message"><p>Your account is verified. You can now sign in.</p><Link className="primary-button auth-submit" href="/login">Continue to sign in <ArrowRight size={14} /></Link></div>}
    {status === "invalid" && <div className="auth-flow-message"><p>{message} Sign in with your email and password to request a fresh verification link.</p><Link className="primary-button auth-submit" href="/login">Go to sign in <ArrowRight size={14} /></Link></div>}
  </AuthFlowCard>;
}

export function ForgotPasswordFlow() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "The request could not be completed. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthFlowCard eyebrow="ACCOUNT RECOVERY" title={submitted ? "Check your inbox" : "Reset your password"}>
    {submitted ? <div className="auth-flow-message"><p>If an eligible account uses <b>{email}</b>, we sent a password reset link. Check your inbox and spam folder.</p><Link className="auth-text-link" href="/login">Back to sign in</Link></div> : <>
      <p className="auth-intro">Enter the email address on your account. We’ll send a one-time reset link if it matches an eligible account.</p>
      <form className="auth-form" onSubmit={submit}>
        <label className="auth-label">Email address<span className="auth-input-wrap"><Mail size={16} /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></span></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}<ArrowRight size={15} /></button>
      </form>
      <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
    </>}
  </AuthFlowCard>;
}

export function ResetPasswordFlow() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const tokenFromLink = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState({}, document.title, window.location.pathname);
    setToken(tokenFromLink);
    if (!tokenFromLink) {
      setStatus("invalid");
      setError("This password reset link is missing or invalid.");
      return;
    }
    verifyPasswordResetToken(tokenFromLink).then(() => setStatus("ready")).catch((requestError) => {
      setStatus("invalid");
      setError(requestError.message || "This password reset link is invalid or expired.");
    });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be 72 bytes or fewer.");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordWithToken({ token, newPassword: password, confirmPassword });
      setStatus("complete");
    } catch (requestError) {
      setError(requestError.message || "The password could not be reset. Request a new link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthFlowCard eyebrow="ACCOUNT RECOVERY" title={status === "complete" ? "Password updated" : "Choose a new password"}>
    {status === "checking" && <div className="auth-flow-message"><p>Checking your reset link…</p></div>}
    {status === "invalid" && <div className="auth-flow-message"><p>{error}</p><Link className="primary-button auth-submit" href="/forgot-password">Request a new link <ArrowRight size={14} /></Link></div>}
    {status === "complete" && <div className="auth-flow-message"><p>Your password was updated and other active sessions were signed out.</p><Link className="primary-button auth-submit" href="/login">Sign in with your new password <ArrowRight size={14} /></Link></div>}
    {status === "ready" && <form className="auth-form" onSubmit={submit}>
      <label className="auth-label">New password<span className="auth-input-wrap"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></span><small className="auth-hint">Use 12 or more characters.</small></label>
      <label className="auth-label">Confirm new password<span className="auth-input-wrap"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></span></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}<ArrowRight size={15} /></button>
    </form>}
  </AuthFlowCard>;
}
