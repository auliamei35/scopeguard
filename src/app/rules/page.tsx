// src/app/rules/page.tsx

// src/app/rules/page.tsx

import Link from 'next/link';
import { getAllAgents } from '@/lib/agent-registry'; 

// ── Icons ─────────────────────────────────────────────
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const GLOBAL_RULES = [
  { id: 'R-001', name: 'Mandatory Agent Identity', description: 'Every request must carry a valid Auth0 M2M token with agent_id claim. Requests without registered agent identity are rejected at Layer 1 before any processing occurs.', layer: 'L1', status: 'enforced', severity: 'critical' },
  { id: 'R-002', name: 'Zero Standing Credentials', description: 'Agents never hold provider credentials directly. All API access is mediated through Auth0 Token Vault via short-lived scoped token exchange. Tokens expire in 300 seconds.', layer: 'TV', status: 'enforced', severity: 'critical' },
  { id: 'R-003', name: 'LLM-Proof Hard Constraints', description: 'Amount ceiling, domain whitelist, velocity cap, and forbidden scope list run as pure code in Layer 2 — before LLM is consulted. These constraints cannot be overridden by prompt injection.', layer: 'L2', status: 'enforced', severity: 'critical' },
  { id: 'R-004', name: 'Minimal Scope Per Action', description: 'Layer 3 (Gemini) determines the minimum scopes needed for each specific tool call. Agents receive only what is required for the immediate action, not their full declared capability set.', layer: 'L3', status: 'enforced', severity: 'high' },
  { id: 'R-005', name: 'Step-Up for High-Stakes Actions', description: 'Any action exceeding the per-agent USD threshold or classified as irreversible triggers CIBA out-of-band approval. The agent pauses and cannot proceed until explicit user consent is received.', layer: 'CIBA', status: 'enforced', severity: 'high' },
  { id: 'R-006', name: 'Complete Audit Trail', description: 'Every gateway request produces a structured audit log entry including: agent_id, tool name, scopes granted vs scopes actually used, risk level, step-up status, and constraint violations.', layer: 'Audit', status: 'enforced', severity: 'medium' },
  { id: 'R-007', name: 'Velocity Rate Limiting', description: 'Per-agent action count is tracked in a rolling 60-second window. Exceeding the configured limit blocks execution and triggers an audit log entry with VELOCITY_CAP violation.', layer: 'L2', status: 'enforced', severity: 'medium' },
  { id: 'R-008', name: 'Domain Whitelist Enforcement', description: 'Agents may only call pre-approved API endpoints. Attempts to reach non-whitelisted domains are blocked at Layer 2 regardless of the tool name or parameters provided.', layer: 'L2', status: 'enforced', severity: 'high' },
];

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  high:     { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  medium:   { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
};

const LAYER_STYLE: Record<string, { bg: string; color: string }> = {
  L1:   { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
  L2:   { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
  L3:   { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
  TV:   { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
  CIBA: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
  Audit:{ bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
};

export default async function SecurityRulesPage() {
  // HIGHLIGHT: Mengambil data langsung dari server registry
  const agents = getAllAgents();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0e1a;--surface:#111827;--surface2:#1a2235;--surface3:#1e2d45;--border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--text:#f1f5f9;--text-2:#94a3b8;--text-3:#475569;--font:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace}
        body{background:var(--bg);font-family:var(--font);color:var(--text)}
        .page{max-width:860px;margin:0 auto;padding:40px 24px 80px}
        .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:13px;text-decoration:none;margin-bottom:28px}
        .back-link:hover{color:var(--text-2)}
        .page-title{font-size:22px;font-weight:600;letter-spacing:-0.4px;margin-bottom:4px}
        .page-sub{font-size:13px;color:var(--text-2);margin-bottom:32px}
        .section-title{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.7px;margin-bottom:14px}
        .rule-list{display:flex;flex-direction:column;gap:10px;margin-bottom:32px}
        .rule-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:16px 18px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start;transition:border-color 0.15s}
        .rule-card:hover{border-color:var(--border2)}
        .rule-id{font-size:11px;font-family:var(--mono);color:var(--text-3);margin-bottom:6px}
        .rule-name{font-size:14px;font-weight:500;margin-bottom:6px}
        .rule-desc{font-size:12px;color:var(--text-2);line-height:1.6}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:var(--mono);white-space:nowrap}
        .badges{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
        .rule-icon{width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;color:#10b981;flex-shrink:0;margin-top:2px}
        .agent-limits{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;overflow:hidden}
        .agent-limits-header{padding:14px 18px;border-bottom:0.5px solid var(--border);font-size:14px;font-weight:500}
        .limits-table{width:100%;border-collapse:collapse}
        .limits-table th{padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.6px;border-bottom:0.5px solid var(--border)}
        .limits-table td{padding:10px 16px;font-size:13px;border-bottom:0.5px solid var(--border);font-family:var(--mono)}
        .limits-table tr:last-child td{border-bottom:none}
      `}</style>

      <div className="page">
        <Link href="/dashboard" className="back-link"><IconArrowLeft /> Back to Dashboard</Link>
        <h1 className="page-title">Security Rules</h1>
        <p className="page-sub">All enforced policies across the ScopeGuard gateway — active on every request.</p>

        <div className="section-title">Global enforcement rules ({GLOBAL_RULES.length} active)</div>
        <div className="rule-list">
          {GLOBAL_RULES.map(rule => {
            const sev = SEVERITY_STYLE[rule.severity];
            const lay = LAYER_STYLE[rule.layer] ?? LAYER_STYLE.Audit;
            return (
              <div key={rule.id} className="rule-card">
                <div className="rule-icon"><IconShield /></div>
                <div>
                  <div className="rule-id">{rule.id}</div>
                  <div className="rule-name">{rule.name}</div>
                  <div className="rule-desc">{rule.description}</div>
                </div>
                <div className="badges">
                  <span className="badge" style={{ background: lay.bg, color: lay.color }}>{rule.layer}</span>
                  <span className="badge" style={{ background: sev.bg, color: sev.color }}>{rule.severity}</span>
                  <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>active</span>
                </div>
              </div>
            );
          })}
        </div>

        {agents.length > 0 && (
          <>
            <div className="section-title">Per-agent hard limits</div>
            <div className="agent-limits">
              <div className="agent-limits-header">Agent-specific constraints enforced at Layer 2</div>
              <table className="limits-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Max amount</th>
                    <th>Step-up above</th>
                    <th>Rate limit</th>
                    <th>Allowed domains</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(agent => (
                    <tr key={agent.agentId}>
                      <td style={{ fontFamily: 'var(--font)', fontWeight: 500, color: 'var(--text)' }}>
                        {agent.agentId.split('-')[0]} agent
                      </td>
                      <td style={{ color: agent.hardLimits.maxTransactionAmountUSD === 0 ? 'var(--text-3)' : '#ef4444' }}>
                        {agent.hardLimits.maxTransactionAmountUSD === 0 ? 'N/A' : `$${agent.hardLimits.maxTransactionAmountUSD.toLocaleString()}`}
                      </td>
                      <td style={{ color: '#f59e0b' }}>
                        {agent.hardLimits.requiresStepUpAboveUSD === 0 ? 'Always' : `$${agent.hardLimits.requiresStepUpAboveUSD.toLocaleString()}`}
                      </td>
                      <td>{agent.hardLimits.maxActionsPerMinute}/min</td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        {agent.hardLimits.allowedDomains.slice(0, 2).join(', ')}
                        {agent.hardLimits.allowedDomains.length > 2 ? '...' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}