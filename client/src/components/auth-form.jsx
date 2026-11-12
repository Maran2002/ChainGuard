"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { loginAccount, registerAccount } from "../services/api";

export default function AuthForm({ mode = "login" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (isRegister && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (isRegister && new TextEncoder().encode(password).length > 72) {
      setError("Password must be 72 bytes or fewer.");
      return;
    }
    setBusy(true);
    try {
      const action = isRegister ? registerAccount({ name, email, password }) : loginAccount({ email, password });
      await action;
      router.replace("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-glow" />
    <div className="auth-top"><Link href="/dashboard" className="brand auth-brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span className="brand-name">chain<span>guard</span><small>RISK INTELLIGENCE</small></span></Link><span className="auth-top-note"><span className="live-dot" /> SECURE WORKSPACE</span></div>
    <section className="auth-card">
      <div className="auth-icon"><Fingerprint size={21} /></div>
      <div className="auth-eyebrow">{isRegister ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</div>
      <h1>{isRegister ? "Start investigating" : "Sign in to ChainGuard"}</h1>
      <p className="auth-intro">{isRegister ? "Create a workspace account to save and review investigations." : "Access your wallet risk workspace and investigation history."}</p>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label className="auth-label">Full name<span className="auth-input-wrap"><UserRound size={16} /><input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></span></label>}
        <label className="auth-label">Work email<span className="auth-input-wrap"><Mail size={16} /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></span></label>
        <label className="auth-label">Password<span className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : 1} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "At least 12 characters" : "Enter your password"} /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>{isRegister && <small className="auth-hint">Use 12 or more characters. Passwords are securely hashed.</small>}</label>
        {isRegister && <label className="auth-label">Confirm password<span className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></span></label>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}<ArrowRight size={15} /></button>
      </form>
      <div className="auth-switch">{isRegister ? "Already have an account?" : "New to ChainGuard?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></div>
      <div className="auth-security"><ShieldCheck size={14} /> Passwords are never stored in plain text. Sessions use secure, HttpOnly cookies.</div>
    </section>
    <footer className="auth-footer"><span>ChainGuard · Wallet risk intelligence</span><span>Read-only investigation platform</span></footer>
  </main>;
}
