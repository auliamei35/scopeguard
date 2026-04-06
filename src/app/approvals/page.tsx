// src/app/approvals/page.tsx
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import { ApprovalRequest, ApprovalStatus, RiskLevel } from '@/types/approvals';

// ── Icons ─────────────────────────────────────────────────────────────────────

const BackIcon = memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
));
BackIcon.displayName = 'BackIcon';

const CheckIcon = memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
));
CheckIcon.displayName = 'CheckIcon';

const XIcon = memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
));
XIcon.displayName = 'XIcon';

const ShieldCheckIcon = memo(({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
));
ShieldCheckIcon.displayName = 'ShieldCheckIcon';

const ClockIcon = memo(() => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
));
ClockIcon.displayName = 'ClockIcon';

const SpinnerIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.7s linear infinite' }}>
    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
));
SpinnerIcon.displayName = 'SpinnerIcon';

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<RiskLevel, { bg: string; border: string; color: string }> = {
  low:      { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981' },
  medium:   { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  color: '#f59e0b' },
  high:     { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' },
  critical: { bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.35)',   color: '#dc2626' },
};

const SEVERITY_COLOR = { info: '#60a5fa', warn: '#f59e0b', critical: '#ef4444' };
const SEVERITY_PREFIX = { info: '○', warn: '△', critical: '▲' };

// Scopes considered high-risk — highlighted in red
const DANGEROUS_SCOPE_PATTERNS = ['write', 'delete', 'payment', 'sar', 'flag', 'admin', 'payroll'];

function isDangerousScope(scope: string): boolean {
  return DANGEROUS_SCOPE_PATTERNS.some(p => scope.includes(p));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins === 0) return 'Just now';
  if (mins === 1) return '1 min ago';
  return `${mins} mins ago`;
}

function useCountdown(expiresAt: Date): { label: string; now: number } {
  // Gunakan () => Date.now() agar dianggap sebagai 'Lazy Initializer'
  const [now, setNow] = useState(() => Date.now()); 

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  
  const label = remaining === 0 ? 'Expired' : `${m}:${String(s).padStart(2, '0')}`;
  
  return { label, now };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CountdownBadge = memo(({ expiresAt, status }: { expiresAt: Date; status: ApprovalStatus }) => {
  const { label, now } = useCountdown(expiresAt); // Ambil 'now' dari hook
  if (status !== 'pending') return null;

  // Gunakan 'now' yang stabil dari state, bukan Date.now() langsung
  const isUrgent = expiresAt.getTime() - now < 60000;
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
      padding: '3px 9px', borderRadius: 20,
      background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
      color: isUrgent ? '#ef4444' : 'var(--text-3)',
      border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.3)' : 'var(--border-1)'}`,
      animation: isUrgent ? 'pulse-urgent 1s ease infinite' : 'none',
    }}>
      <ClockIcon /> {label === 'Expired' ? 'Expired' : `Expires ${label}`}
    </span>
  );
});
CountdownBadge.displayName = 'CountdownBadge';

interface RequestCardProps {
  req: ApprovalRequest;
  loadingId: string | null;
  onResolve: (id: string, decision: 'approved' | 'denied') => void;
  index: number;
}

const RequestCard = memo(({ req, loadingId, onResolve, index }: RequestCardProps) => {
  const risk = RISK_STYLE[req.riskLevel];
  const isLoading = loadingId === req.id;

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${req.agentColor}20`,
        borderLeft: `3px solid ${req.agentColor}`,
        borderRadius: 16, overflow: 'hidden',
        animationDelay: `${index * 0.07}s`,
        boxShadow: `0 0 0 0 ${req.agentColor}`,
      }}
    >
      {/* ── Card header ── */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${req.agentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: req.agentColor, flexShrink: 0 }}>
            <ShieldCheckIcon />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{req.agentLabel}</span>
              {/* Point 2: verified badge */}
              {req.agentVerified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)', letterSpacing: '0.3px' }}>
                  ✓ VERIFIED
                </span>
              )}
            </div>
            {/* Point 2: session + agent ID */}
            <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{req.agentId}</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>· {req.sessionId}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Risk badge */}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {req.riskLevel} risk
          </span>
          {/* Bonus 1: countdown */}
          <CountdownBadge expiresAt={req.expiresAt} status={req.status} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockIcon /> {timeAgo(req.createdAt)}
          </span>
        </div>
      </div>

      <div style={{ padding: '18px 20px' }}>
        {/* ── Metadata grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          {([
            ['Action', req.tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), null],
            req.amount ? ['Amount', `${req.currency ?? '$'}${req.amount.toLocaleString()}`, 'mono'] : null,
            req.destination ? ['Destination', req.destination, null] : null,
            ['Requested by', `${req.agentLabel}${req.agentVerified ? ' (verified)' : ''}`, null],
            ['Session', req.sessionId, 'mono'],
            ['Reversible', req.reversible ? 'Yes ✓' : 'No ✗', null],
          ].filter((item): item is [string, string, string | null] => item !== null)) // Type guard di sini
            .map(([k, v, mono]) => (
              <div key={k} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{k}</div>
                <div style={{
                  fontSize: 12, fontWeight: 500,
                  fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                  color: k === 'Reversible'
                    ? (req.reversible ? '#34d399' : '#f87171')
                    : k === 'Amount' ? '#fbbf24'
                    : 'var(--text)',
                }}>
                  {v}
                </div>
              </div>
  ))}
        </div>

        {/* ── Scopes (Bonus 2: highlight dangerous) ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            Permissions requested
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {req.scopes.map(s => {
              const danger = isDangerousScope(s);
              return (
                <span key={s} style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  background: danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-3)',
                  border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'var(--border-1)'}`,
                  borderRadius: 6, padding: '3px 10px',
                  color: danger ? '#f87171' : 'var(--text-2)',
                  fontWeight: danger ? 600 : 400,
                }}>
                  {danger && <span style={{ marginRight: 4 }}>⚠</span>}{s}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Point 3: structured risk reasons ── */}
        <div style={{ background: `${req.agentColor}06`, border: `1px solid ${req.agentColor}18`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
            Why this requires approval
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {req.riskReasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                <span style={{ color: SEVERITY_COLOR[r.severity], flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 2 }}>
                  {SEVERITY_PREFIX[r.severity]}
                </span>
                <span style={{ color: r.severity === 'critical' ? 'var(--text)' : 'var(--text-2)' }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Point 4: consequences of deny ── */}
        <div style={{ background: 'rgba(100,116,139,0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
            If denied
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {req.denyConsequences.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--text-3)' }}>
                <span style={{ color: '#475569', flexShrink: 0 }}>→</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-deny"
            onClick={() => onResolve(req.id, 'denied')}
            disabled={isLoading}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px', borderRadius: 10,
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 14, fontWeight: 600,
              transition: 'background 0.15s', opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? <SpinnerIcon /> : <XIcon />} Deny
          </button>
          <button
            className="btn-approve"
            onClick={() => onResolve(req.id, 'approved')}
            disabled={isLoading}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px', borderRadius: 10,
              background: '#059669', border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 600,
              transition: 'background 0.15s', opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? <SpinnerIcon /> : <CheckIcon />} Approve
          </button>
        </div>
      </div>
    </div>
  );
});
RequestCard.displayName = 'RequestCard';

// ── Resolved row ──────────────────────────────────────────────────────────────

const ResolvedRow = memo(({ req }: { req: ApprovalRequest }) => {
  const statusColor = req.status === 'approved' ? '#10b981' : req.status === 'expired' ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: 0.75, flexWrap: 'wrap', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: req.agentColor, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {req.agentLabel} — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{req.tool.replace(/_/g, ' ')}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            {req.amount && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {req.currency ?? '$'}{req.amount.toLocaleString()}
              </span>
            )}
            {/* Point 5: audit trail */}
            {req.resolvedBy && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                · {req.status === 'approved' ? 'Approved' : 'Denied'} by {req.resolvedBy}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {req.resolvedAt && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockIcon /> {timeAgo(req.resolvedAt)}
          </span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: `${statusColor}15`, color: statusColor,
          textTransform: 'capitalize', border: `1px solid ${statusColor}30`,
        }}>
          {req.status}
        </span>
      </div>
    </div>
  );
});
ResolvedRow.displayName = 'ResolvedRow';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Load initial data from API
  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/approve/list');
      if (res.ok) {
        const data = await res.json();
        // Rehydrate Date objects
        setRequests(data.map((r: ApprovalRequest) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          expiresAt: new Date(r.expiresAt),
          resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : undefined,
        })));
      }
    } catch {
      // fallback: no-op (page renders empty state)
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    // Poll for new requests every 5s (in case /ask triggers a new step-up)
    const id = setInterval(fetchRequests, 5000);
    return () => clearInterval(id);
  }, [fetchRequests]);

  // Point 1 + Point 7: call API, show loading state, update local state on success
  const resolve = useCallback(async (id: string, decision: 'approved' | 'denied') => {
    setLoadingId(id);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          decision,
          resolvedBy: 'user@example.com', // replace with real auth session
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRequests(prev => prev.map(r =>
          r.id === id
            ? { ...r, status: decision, resolvedAt: new Date(), resolvedBy: 'user@example.com' }
            : r
        ));
      } else {
        // Surface API error (e.g. already resolved, expired)
        console.error('Approve error:', data.error);
        // Refresh to get current state from server
        await fetchRequests();
      }
    } catch (err) {
      console.error('Network error during resolve:', err);
    } finally {
      setLoadingId(null);
    }
  }, [fetchRequests]);

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');
  const expiredCount = resolved.filter(r => r.status === 'expired').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#060910;--bg-2:#111827;--bg-3:#1a2235;
          --border:rgba(255,255,255,0.05);--border-1:rgba(255,255,255,0.09);--border-2:rgba(255,255,255,0.14);
          --text:#f1f5f9;--text-2:#94a3b8;--text-3:#64748b;
          --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;--font-mono:'JetBrains Mono',monospace
        }
        body{background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased;}
        button{font-family:var(--font-body);}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-urgent{0%,100%{opacity:1}50%{opacity:0.6}}
        .card{animation:fade-up 0.3s ease both}
        .btn-approve:hover:not(:disabled){background:#047857 !important;}
        .btn-deny:hover:not(:disabled){background:rgba(239,68,68,0.14) !important;}
      `}</style>

      <div style={{ minHeight: '100vh', maxWidth: 820, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Back nav */}
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 28 }}>
          <BackIcon /> Dashboard
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>
              Pending Approvals
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              High-stakes agent actions waiting for your explicit confirmation before execution.
            </p>
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            {[
              { label: 'Pending', value: pending.length, color: '#f59e0b' },
              { label: 'Resolved', value: resolved.length - expiredCount, color: '#10b981' },
              { label: 'Expired', value: expiredCount, color: '#64748b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 64 }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending section */}
        {pageLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-3)', gap: 10, fontSize: 13 }}>
            <SpinnerIcon /> Loading approvals…
          </div>
        ) : pending.length === 0 ? (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>No pending approvals</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>All agents are operating within automatic limits</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {pending.map((req, i) => (
              <RequestCard
                key={req.id}
                req={req}
                index={i}
                loadingId={loadingId}
                onResolve={resolve}
              />
            ))}
          </div>
        )}

        {/* Resolved section — Point 5: full audit trail */}
        {resolved.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
              Audit trail · {resolved.length} resolved
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolved.map(req => <ResolvedRow key={req.id} req={req} />)}
            </div>
          </>
        )}

        {/* Bonus 3: integration hint */}
        <div style={{ marginTop: 48, background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0, fontSize: 18 }}>⇄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Connected to Agent Simulator</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Approvals here unblock the CIBA step in <Link href="/ask" style={{ color: '#60a5fa', textDecoration: 'none' }}>/ask</Link>. The simulator polls this API every 2 seconds — approve or deny above to continue execution.
            </div>
          </div>
          <Link href="/ask" style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', textDecoration: 'none', padding: '7px 14px', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, flexShrink: 0, background: 'rgba(59,130,246,0.06)' }}>
            Open Simulator →
          </Link>
        </div>
      </div>
    </>
  );
}