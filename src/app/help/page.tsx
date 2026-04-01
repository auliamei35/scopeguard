// src/app/help/page.tsx
import Link from 'next/link';

const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const FAQS = [
  {
    q: 'What does ScopeGuard actually do?',
    a: 'ScopeGuard is a gateway that sits between AI agents and the APIs they call. Every tool call is intercepted, verified against hard constraints, analyzed by an LLM to determine minimal permissions, and — if the action is high-stakes — paused for human approval via CIBA step-up authentication.'
  },
  {
    q: 'Why do we need hard constraints if we already have an LLM analyzer?',
    a: 'LLMs can be manipulated through prompt injection. A malicious instruction embedded in user input could convince the LLM to classify a dangerous action as low-risk. Hard constraints (Layer 2) run as pure code before the LLM is consulted — they cannot be overridden by prompt content, only by changing the agent registry configuration.'
  },
  {
    q: 'What is Auth0 Token Vault?',
    a: 'Token Vault is an Auth0 feature that securely stores OAuth tokens for third-party providers (Google, GitHub, Slack, etc.). Instead of your agent holding a long-lived API key, Token Vault issues short-lived scoped tokens on demand. ScopeGuard uses Token Vault to ensure agents never possess plaintext credentials.'
  },
  {
    q: 'What is CIBA and how does step-up auth work?',
    a: 'Client-Initiated Backchannel Authentication (CIBA) is an OAuth flow that allows a server to initiate an authentication request to a user out-of-band — for example, via push notification. When ScopeGuard detects a high-stakes action, the agent is paused and a CIBA request is sent. The agent only resumes after the user explicitly approves.'
  },
  {
    q: 'What is "scope reduction" in the dashboard?',
    a: 'Scope reduction measures how much ScopeGuard narrowed the permissions compared to what the agent declared. A travel agent declaring [payment:write, calendar:events:write, email:send] that only uses [payment:write, email:send] for a specific booking represents a 33% reduction. For a read-only search, 100% of declared scopes were unnecessary.'
  },
  {
    q: 'How is this different from just using OAuth scopes normally?',
    a: 'Standard OAuth scopes are granted once and remain valid until revoked. ScopeGuard dynamically narrows the scope per action at runtime — what the agent declared is the ceiling, but what it actually receives depends on what it is doing right now. This prevents the "blast radius" problem where a single granted scope enables far more than intended.'
  },
  {
    q: 'Is this production-ready?',
    a: 'The architecture and security model are production-grade. For this hackathon MVP, tool execution returns a structured mock result instead of calling real provider APIs. The Token Vault integration, CIBA flow, and audit trail are real Auth0 implementations. Replacing the mock executor with real API calls is the primary production step.'
  },
];

export default function HelpPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0e1a;--surface:#111827;--surface2:#1a2235;--border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--text:#f1f5f9;--text-2:#94a3b8;--text-3:#475569;--font:'DM Sans',sans-serif}
        body{background:var(--bg);font-family:var(--font);color:var(--text)}
        .page{max-width:720px;margin:0 auto;padding:40px 24px 80px}
        .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:13px;text-decoration:none;margin-bottom:28px}
        .back-link:hover{color:var(--text-2)}
        .page-title{font-size:22px;font-weight:600;letter-spacing:-0.4px;margin-bottom:4px}
        .page-sub{font-size:13px;color:var(--text-2);margin-bottom:32px}
        .section-title{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.7px;margin-bottom:14px}
        .faq-list{display:flex;flex-direction:column;gap:10px;margin-bottom:32px}
        .faq{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:18px 20px}
        .faq-q{font-size:14px;font-weight:500;margin-bottom:10px;color:var(--text)}
        .faq-a{font-size:13px;color:var(--text-2);line-height:1.7}
        .links{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .link-card{display:flex;flex-direction:column;gap:4px;padding:16px;background:var(--surface);border:0.5px solid var(--border);border-radius:12px;text-decoration:none;transition:border-color 0.15s}
        .link-card:hover{border-color:var(--border2)}
        .link-title{font-size:13px;font-weight:500;color:var(--text)}
        .link-sub{font-size:12px;color:var(--text-3)}
      `}</style>

      <div className="page">
        <Link href="/dashboard" className="back-link"><IconArrowLeft /> Back to Dashboard</Link>
        <h1 className="page-title">Help & Documentation</h1>
        <p className="page-sub">Frequently asked questions about ScopeGuard and how it works.</p>

        <div className="section-title">Frequently asked questions</div>
        <div className="faq-list">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="faq">
              <div className="faq-q">{q}</div>
              <div className="faq-a">{a}</div>
            </div>
          ))}
        </div>

        <div className="section-title">Resources</div>
        <div className="links">
          {[
            { title: 'Auth0 Token Vault docs', sub: 'auth0.com/ai/docs/intro/token-vault', href: 'https://auth0.com/ai/docs/intro/token-vault' },
            { title: 'OWASP Top 10 for Agentic AI', sub: 'genai.owasp.org', href: 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/' },
            { title: 'Gravitee Security Report 2026', sub: 'gravitee.io/state-of-ai-agent-security', href: 'https://www.gravitee.io/state-of-ai-agent-security' },
            { title: 'CIBA specification (RFC)', sub: 'openid.net/specs/openid-client-initiated-backchannel', href: 'https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html' },
          ].map(({ title, sub, href }) => (
            <a key={title} href={href} target="_blank" rel="noopener" className="link-card">
              <div className="link-title">{title}</div>
              <div className="link-sub">{sub}</div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}