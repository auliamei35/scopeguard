// src/app/consent/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface AgentPermission {
  agentId: string;
  agentType: string;
  isActive: boolean;
  version: string;
  createdAt: string;
  permissions: {
    declared: string[];
    humanReadable: string[];
  };
  limits: {
    maxTransactionUSD: number;
    stepUpThresholdUSD: number;
    allowedDomains: string[];
    maxActionsPerMinute: number;
    forbiddenScopes: string[];
  };
}

// Step-up approval modal state
interface StepUpRequest {
  agentId: string;
  action: string;
  amount: number;
  explanation: string;
}

const SCOPE_RISK: Record<string, 'low' | 'medium' | 'high'> = {
  'payment:write':         'high',
  'email:send':            'medium',
  'calendar:events:write': 'low',
  'files:write':           'high',
  'contacts:read':         'low',
  'email:read':            'medium',
};

// SVG Icons
const IconShield = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconAlertTriangle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const IconLock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IconZap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

export default function ConsentPage() {
  const [agents, setAgents] = useState<AgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [stepUpDemo, setStepUpDemo] = useState<StepUpRequest | null>(null);
  const [stepUpResult, setStepUpResult] = useState<'approved' | 'denied' | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const json = await res.json();
      setAgents(json.agents || []);
      if (json.agents?.length > 0) {
        setExpandedAgent(json.agents[0].agentId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleRevoke = async (agentId: string) => {
    setRevoking(agentId);
    await fetch(`/api/agents?agentId=${agentId}`, { method: 'DELETE' });
    await fetchAgents();
    setRevoking(null);
  };

  const triggerStepUpDemo = (agent: AgentPermission) => {
    setStepUpResult(null);
    setStepUpDemo({
      agentId: agent.agentId,
      action: 'Book flight to Tokyo on April 20, 2026 via Garuda Indonesia',
      amount: 500,
      explanation: 'This action will book a flight to Tokyo for $500 using your payment method and send you a confirmation email. This action cannot be undone.',
    });
  };

  const riskColor = (risk: 'low' | 'medium' | 'high') => ({
    low:    { bg: 'rgba(16,185,129,0.1)',  text: '#059669', label: 'Low risk' },
    medium: { bg: 'rgba(245,158,11,0.1)',  text: '#d97706', label: 'Medium risk' },
    high:   { bg: 'rgba(239,68,68,0.1)',   text: '#dc2626', label: 'High risk' },
  }[risk]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0e1a; --surface: #111827; --surface2: #1a2235; --surface3: #1e2d45;
          --border: rgba(255,255,255,0.06); --border2: rgba(255,255,255,0.12);
          --blue: #2563eb; --blue-l: #3b82f6; --blue-xl: #60a5fa;
          --green: #10b981; --red: #ef4444; --orange: #f59e0b; --purple: #8b5cf6;
          --text: #f1f5f9; --text-2: #94a3b8; --text-3: #475569;
          --font: 'DM Sans', sans-serif; --mono: 'JetBrains Mono', monospace;
          --r: 12px; --r-lg: 16px;
        }
        body { background: var(--bg); font-family: var(--font); color: var(--text); min-height: 100vh; }
        .page { max-width: 860px; margin: 0 auto; padding: 40px 24px 80px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 13px; text-decoration: none; margin-bottom: 28px; transition: color 0.15s; }
        .back-link:hover { color: var(--text-2); }
        .page-header { margin-bottom: 32px; }
        .page-title { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: var(--text-2); line-height: 1.6; max-width: 560px; }
        .info-bar { background: rgba(37,99,235,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: var(--r); padding: 14px 18px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 28px; }
        .info-bar-icon { color: var(--blue-xl); flex-shrink: 0; margin-top: 1px; }
        .info-bar-text { font-size: 13px; color: #93c5fd; line-height: 1.55; }
        .info-bar-text strong { color: #bfdbfe; }
        .agent-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); margin-bottom: 16px; overflow: hidden; transition: border-color 0.2s; }
        .agent-card.expanded { border-color: var(--border2); }
        .agent-card.revoked { opacity: 0.5; }
        .agent-header { padding: 18px 20px; display: flex; align-items: center; gap: 14px; cursor: pointer; }
        .agent-avatar { width: 40px; height: 40px; border-radius: 10px; background: rgba(37,99,235,0.15); display: flex; align-items: center; justify-content: center; color: var(--blue-xl); flex-shrink: 0; }
        .agent-info { flex: 1; min-width: 0; }
        .agent-name { font-size: 15px; font-weight: 600; margin-bottom: 3px; }
        .agent-meta { font-size: 12px; color: var(--text-3); font-family: var(--mono); display: flex; gap: 12px; }
        .status-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
        .status-active { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-revoked { background: rgba(239,68,68,0.1); color: #ef4444; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .chevron { color: var(--text-3); transition: transform 0.2s; flex-shrink: 0; }
        .chevron.open { transform: rotate(180deg); }
        .agent-body { border-top: 1px solid var(--border); }
        .section-block { padding: 20px; border-bottom: 1px solid var(--border); }
        .section-block:last-child { border-bottom: none; }
        .block-title { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 14px; }
        .perm-list { display: flex; flex-direction: column; gap: 10px; }
        .perm-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface2); border-radius: 10px; border: 0.5px solid var(--border); }
        .perm-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .perm-text { flex: 1; }
        .perm-name { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
        .perm-scope { font-size: 11px; color: var(--text-3); font-family: var(--mono); }
        .risk-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; font-family: var(--mono); }
        .limits-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .limit-item { background: var(--surface2); border-radius: 8px; padding: 12px 14px; border: 0.5px solid var(--border); }
        .limit-label { font-size: 11px; color: var(--text-3); margin-bottom: 4px; display: flex; align-items: center; gap: 5px; }
        .limit-value { font-size: 14px; font-weight: 600; font-family: var(--mono); color: var(--text); }
        .limit-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
        .domains-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .domain-pill { font-size: 11px; font-family: var(--mono); background: var(--surface2); border: 0.5px solid var(--border2); border-radius: 6px; padding: 4px 10px; color: var(--text-2); }
        .forbidden-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .forbidden-pill { font-size: 11px; font-family: var(--mono); background: rgba(239,68,68,0.08); border: 0.5px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 4px 10px; color: #ef4444; }
        .action-row { padding: 16px 20px; display: flex; gap: 10px; align-items: center; background: var(--surface2); }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: var(--font); transition: all 0.15s; }
        .btn-outline { background: transparent; color: var(--text-2); border: 1px solid var(--border2); }
        .btn-outline:hover { background: var(--surface3); color: var(--text); }
        .btn-blue { background: var(--blue); color: white; }
        .btn-blue:hover { background: #1d4ed8; }
        .btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .btn-danger:hover { background: rgba(239,68,68,0.18); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        /* Step-up Modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 20px; max-width: 420px; width: 100%; overflow: hidden; animation: slideUp 0.25s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .modal-header { padding: 24px 24px 0; text-align: center; }
        .modal-icon { width: 52px; height: 52px; border-radius: 14px; background: rgba(245,158,11,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; color: var(--orange); }
        .modal-title { font-size: 17px; font-weight: 600; margin-bottom: 6px; }
        .modal-sub { font-size: 13px; color: var(--text-2); line-height: 1.5; }
        .modal-body { padding: 20px 24px; }
        .modal-detail { background: var(--surface2); border-radius: 10px; padding: 14px; border: 0.5px solid var(--border); margin-bottom: 16px; }
        .modal-detail-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 0.5px solid var(--border); }
        .modal-detail-row:last-child { border-bottom: none; }
        .modal-detail-label { color: var(--text-3); }
        .modal-detail-value { font-weight: 500; font-family: var(--mono); }
        .modal-explanation { font-size: 13px; color: var(--text-2); line-height: 1.6; margin-bottom: 6px; padding: 12px; background: rgba(245,158,11,0.06); border-radius: 8px; border: 0.5px solid rgba(245,158,11,0.15); }
        .modal-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 24px 24px; }
        .btn-approve { background: var(--green); color: white; justify-content: center; font-size: 14px; padding: 12px; border-radius: 10px; }
        .btn-approve:hover { background: #059669; }
        .btn-deny { background: var(--surface2); color: var(--text-2); border: 1px solid var(--border2); justify-content: center; font-size: 14px; padding: 12px; border-radius: 10px; }
        .btn-deny:hover { background: var(--surface3); color: var(--text); }
        .result-banner { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-radius: 10px; margin-bottom: 12px; font-size: 13px; font-weight: 500; }
        .result-approved { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
        .result-denied { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .empty { text-align: center; padding: 60px 20px; color: var(--text-3); }
        .empty-title { font-size: 16px; font-weight: 500; margin-bottom: 6px; color: var(--text-2); }
      `}</style>

      <div className="page">
        <Link href="/dashboard" className="back-link">
          <IconArrowLeft />
          Back to Dashboard
        </Link>

        <div className="page-header">
          <h1 className="page-title">Agent Permissions & Consent</h1>
          <p className="page-sub">
            Review what each AI agent is allowed to do on your behalf.
            You can see exactly which permissions have been granted and revoke access at any time.
          </p>
        </div>

        <div className="info-bar">
          <div className="info-bar-icon"><IconShield size={16} /></div>
          <div className="info-bar-text">
            <strong>Your data is protected.</strong> Agents never hold your credentials directly.
            All access is granted through short-lived, scoped tokens that expire after each action.
            ScopeGuard enforces hard limits on every request — agents cannot exceed the boundaries you see below.
          </div>
        </div>

        {loading ? (
          <div className="empty"><div className="empty-title">Loading agents...</div></div>
        ) : agents.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No agents registered</div>
            <p>Run the demo to register a travel agent and see its permissions here.</p>
          </div>
        ) : (
          agents.map((agent) => {
            const isExpanded = expandedAgent === agent.agentId;
            return (
              <div
                key={agent.agentId}
                className={`agent-card ${isExpanded ? 'expanded' : ''} ${!agent.isActive ? 'revoked' : ''}`}
              >
                {/* Header */}
                <div className="agent-header" onClick={() => setExpandedAgent(isExpanded ? null : agent.agentId)}>
                  <div className="agent-avatar"><IconShield size={20} /></div>
                  <div className="agent-info">
                    <div className="agent-name">
                      {agent.agentId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div className="agent-meta">
                      <span>{agent.agentType}</span>
                      <span>v{agent.version}</span>
                      <span>Since {new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`status-pill ${agent.isActive ? 'status-active' : 'status-revoked'}`}>
                    <span className="status-dot" />
                    {agent.isActive ? 'Active' : 'Revoked'}
                  </span>
                  <svg className={`chevron ${isExpanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* Body */}
                {isExpanded && (
                  <div className="agent-body">

                    {/* Permissions */}
                    <div className="section-block">
                      <div className="block-title">What this agent can do</div>
                      <div className="perm-list">
                        {agent.permissions.humanReadable.map((perm, i) => {
                          const scope = agent.permissions.declared[i];
                          const risk = SCOPE_RISK[scope] ?? 'low';
                          const rc = riskColor(risk);
                          return (
                            <div key={scope} className="perm-item">
                              <div className="perm-icon" style={{ background: rc.bg }}>
                                <IconCheck />
                              </div>
                              <div className="perm-text">
                                <div className="perm-name">{perm}</div>
                                <div className="perm-scope">{scope}</div>
                              </div>
                              <span
                                className="risk-badge"
                                style={{ background: rc.bg, color: rc.text }}
                              >
                                {rc.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hard Limits */}
                    <div className="section-block">
                      <div className="block-title">Security boundaries — enforced by ScopeGuard, cannot be overridden</div>
                      <div className="limits-grid">
                        <div className="limit-item">
                          <div className="limit-label"><IconLock /> Maximum transaction</div>
                          <div className="limit-value">${agent.limits.maxTransactionUSD.toLocaleString()}</div>
                          <div className="limit-sub">Per single action — hard blocked above this</div>
                        </div>
                        <div className="limit-item">
                          <div className="limit-label"><IconAlertTriangle /> Requires your approval above</div>
                          <div className="limit-value">${agent.limits.stepUpThresholdUSD.toLocaleString()}</div>
                          <div className="limit-sub">You will be asked to confirm</div>
                        </div>
                        <div className="limit-item">
                          <div className="limit-label"><IconZap /> Max actions per minute</div>
                          <div className="limit-value">{agent.limits.maxActionsPerMinute}</div>
                          <div className="limit-sub">Rate limiting enforced at gateway</div>
                        </div>
                        <div className="limit-item">
                          <div className="limit-label"><IconGlobe /> Allowed websites</div>
                          <div className="limit-value">{agent.limits.allowedDomains.length} domains</div>
                          <div className="limit-sub">All other sites are blocked</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
                          Allowed domains
                        </div>
                        <div className="domains-list">
                          {agent.limits.allowedDomains.map(d => (
                            <span key={d} className="domain-pill">{d}</span>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
                          Permanently blocked permissions
                        </div>
                        <div className="forbidden-list">
                          {agent.limits.forbiddenScopes.map(s => (
                            <span key={s} className="forbidden-pill">
                              <IconX /> {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="action-row">
                      {agent.isActive ? (
                        <>
                          <button
                            className="btn btn-blue"
                            onClick={() => triggerStepUpDemo(agent)}
                          >
                            <IconAlertTriangle />
                            Simulate Approval Request
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRevoke(agent.agentId)}
                            disabled={revoking === agent.agentId}
                          >
                            <IconX />
                            {revoking === agent.agentId ? 'Revoking...' : 'Revoke Access'}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                          Access revoked — this agent can no longer perform actions on your behalf.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Step-Up Approval Modal */}
      {stepUpDemo && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setStepUpDemo(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-icon"><IconAlertTriangle /></div>
              <div className="modal-title">Approval Required</div>
              <div className="modal-sub">
                {stepUpDemo.agentId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is requesting permission to perform a high-value action.
              </div>
            </div>

            <div className="modal-body">
              {stepUpResult ? (
                <div className={`result-banner ${stepUpResult === 'approved' ? 'result-approved' : 'result-denied'}`}>
                  {stepUpResult === 'approved' ? <IconCheck /> : <IconX />}
                  {stepUpResult === 'approved'
                    ? 'Action approved — agent will proceed with the booking.'
                    : 'Action denied — agent has been stopped.'}
                </div>
              ) : null}

              <div className="modal-detail">
                <div className="modal-detail-row">
                  <span className="modal-detail-label">Action</span>
                  <span className="modal-detail-value" style={{ fontFamily: 'var(--font)', fontSize: 13 }}>{stepUpDemo.action}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-detail-label">Amount</span>
                  <span className="modal-detail-value" style={{ color: 'var(--orange)' }}>${stepUpDemo.amount.toLocaleString()}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-detail-label">Requested by</span>
                  <span className="modal-detail-value" style={{ fontFamily: 'var(--font)', fontSize: 12 }}>{stepUpDemo.agentId}</span>
                </div>
                <div className="modal-detail-row">
                  <span className="modal-detail-label">Can be undone?</span>
                  <span className="modal-detail-value" style={{ color: 'var(--red)' }}>No</span>
                </div>
              </div>

              <div className="modal-explanation">
                {stepUpDemo.explanation}
              </div>
            </div>

            {!stepUpResult && (
              <div className="modal-footer">
                <button
                  className="btn btn-deny"
                  onClick={() => { setStepUpResult('denied'); setTimeout(() => { setStepUpDemo(null); setStepUpResult(null); }, 2500); }}
                >
                  <IconX /> Deny
                </button>
                <button
                  className="btn btn-approve"
                  onClick={() => { setStepUpResult('approved'); setTimeout(() => { setStepUpDemo(null); setStepUpResult(null); }, 2500); }}
                >
                  <IconCheck /> Approve
                </button>
              </div>
            )}

            {stepUpResult && (
              <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
                <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setStepUpDemo(null); setStepUpResult(null); }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}