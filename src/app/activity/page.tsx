// src/app/activity/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { AuditLogEntry } from '@/types';

const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconFilter = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const EVENT_META: Record<string, { label: string; color: string; bg: string }> = {
  AGENT_IDENTITY_RESOLVED: { label: 'Identity Verified',   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  IDENTITY_REJECTED:       { label: 'Auth Failed',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  CONSTRAINT_PASSED:       { label: 'Constraints Passed',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  CONSTRAINT_BLOCKED:      { label: 'Blocked',             color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  SCOPE_DECIDED:           { label: 'Scope Analyzed',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  STEPUP_TRIGGERED:        { label: 'Approval Needed',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  STEPUP_APPROVED:         { label: 'Approved',            color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  STEPUP_DENIED:           { label: 'Denied',              color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  STEPUP_TIMEOUT:          { label: 'Timed Out',           color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  TOOL_EXECUTED_SUCCESS:   { label: 'Completed',           color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  TOOL_EXECUTION_FAILED:   { label: 'Failed',              color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  AGENT_REVOKED:           { label: 'Agent Revoked',       color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

const ALL_FILTER = 'ALL';
const FILTERS = [ALL_FILTER, 'BLOCKED', 'SUCCESS', 'STEPUP', 'IDENTITY'];

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(ALL_FILTER);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    const res = await fetch('/api/audit');
    const json = await res.json();
    setLogs(json.logs || []);
    setLoading(false);
  }, []);

// eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    const matchFilter =
      filter === ALL_FILTER ||
      (filter === 'BLOCKED' && log.event.includes('BLOCKED')) ||
      (filter === 'SUCCESS' && log.event === 'TOOL_EXECUTED_SUCCESS') ||
      (filter === 'STEPUP'  && log.event.startsWith('STEPUP')) ||
      (filter === 'IDENTITY' && (log.event.includes('IDENTITY') || log.event === 'AGENT_IDENTITY_RESOLVED'));
    const matchSearch = !search ||
      log.event.toLowerCase().includes(search.toLowerCase()) ||
      log.agentId.toLowerCase().includes(search.toLowerCase()) ||
      (log.toolName ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const exportCSV = () => {
    const headers = ['id', 'timestamp', 'event', 'agentId', 'toolName', 'riskLevel', 'stepUpRequired'];
    const rows = filtered.map(l =>
      [l.id, new Date(l.timestamp).toISOString(), l.event, l.agentId,
       l.toolName ?? '', l.riskLevel ?? '', l.stepUpRequired ?? ''].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'scopeguard-audit.csv'; a.click();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0e1a;--surface:#111827;--surface2:#1a2235;--border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--text:#f1f5f9;--text-2:#94a3b8;--text-3:#475569;--font:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace}
        body{background:var(--bg);font-family:var(--font);color:var(--text)}
        .page{max-width:960px;margin:0 auto;padding:40px 24px 80px}
        .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:13px;text-decoration:none;margin-bottom:28px}
        .back-link:hover{color:var(--text-2)}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px}
        .page-title{font-size:22px;font-weight:600;letter-spacing:-0.4px}
        .page-sub{font-size:13px;color:var(--text-2);margin-top:4px}
        .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap}
        .search-input{background:var(--surface);border:0.5px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text);font-family:var(--font);flex:1;min-width:200px;outline:none}
        .search-input:focus{border-color:#3b82f6}
        .search-input::placeholder{color:var(--text-3)}
        .filter-row{display:flex;gap:6px;flex-wrap:wrap}
        .filter-btn{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:0.5px solid var(--border2);background:var(--surface);color:var(--text-2);font-family:var(--font);transition:all 0.15s}
        .filter-btn:hover{background:var(--surface2);color:var(--text)}
        .filter-btn.active{background:#2563eb;color:white;border-color:#2563eb}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:0.5px solid var(--border2);background:var(--surface);color:var(--text-2);font-family:var(--font);transition:all 0.15s}
        .btn:hover{background:var(--surface2);color:var(--text)}
        .count{font-size:12px;color:var(--text-3);margin-bottom:12px}
        .table-wrap{background:var(--surface);border:0.5px solid var(--border);border-radius:14px;overflow:hidden}
        .table{width:100%;border-collapse:collapse}
        .table th{padding:12px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.6px;border-bottom:0.5px solid var(--border)}
        .table td{padding:12px 16px;font-size:13px;border-bottom:0.5px solid var(--border);vertical-align:middle}
        .table tr:last-child td{border-bottom:none}
        .table tr:hover td{background:rgba(255,255,255,0.02)}
        .event-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:var(--mono);white-space:nowrap}
        .mono{font-family:var(--mono);font-size:12px;color:var(--text-3)}
        .risk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
        .scope-diff{font-size:11px;font-family:var(--mono)}
        .empty{text-align:center;padding:48px;color:var(--text-3);font-size:13px}
      `}</style>

      <div className="page">
        <Link href="/dashboard" className="back-link"><IconArrowLeft /> Back to Dashboard</Link>

        <div className="page-header">
          <div>
            <h1 className="page-title">Activity Logs</h1>
            <p className="page-sub">Complete audit trail of every agent action through the ScopeGuard gateway</p>
          </div>
          <button className="btn" onClick={exportCSV}><IconDownload /> Export CSV</button>
        </div>

        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search by event, agent, or tool..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="filter-row">
            {FILTERS.map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === ALL_FILTER ? 'All Events' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="count">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty">Loading logs...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No events match your filter. Run the demo to generate activity.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Tool</th>
                  <th>Agent</th>
                  <th>Scopes: granted → used</th>
                  <th>Risk</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const meta = EVENT_META[log.event] ?? { label: log.event, color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
                  const riskColors: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className="event-badge" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                        {log.constraintViolations?.length ? (
                          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: 'var(--mono)' }}>
                            {log.constraintViolations[0].split(':')[0]}
                          </div>
                        ) : null}
                      </td>
                      <td className="mono">{log.toolName ?? '—'}</td>
                      <td className="mono">{log.agentId}</td>
                      <td>
                        {log.scopesGranted && log.scopesActuallyUsed ? (
                          <div className="scope-diff">
                            <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>
                              {log.scopesGranted.length} scopes
                            </span>
                            {' → '}
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              {log.scopesActuallyUsed.length} used
                            </span>
                          </div>
                        ) : <span className="mono">—</span>}
                      </td>
                      <td>
                        {log.riskLevel ? (
                          <span>
                            <span className="risk-dot" style={{ background: riskColors[log.riskLevel] ?? '#64748b' }} />
                            <span style={{ fontSize: 12, color: riskColors[log.riskLevel] ?? '#64748b', textTransform: 'capitalize' }}>
                              {log.riskLevel}
                            </span>
                          </span>
                        ) : <span className="mono">—</span>}
                      </td>
                      <td className="mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}