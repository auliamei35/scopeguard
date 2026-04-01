// src/app/settings/page.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

export default function SettingsPage() {
  const [autoApprove, setAutoApprove] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('2');
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0e1a;--surface:#111827;--surface2:#1a2235;--border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--text:#f1f5f9;--text-2:#94a3b8;--text-3:#475569;--font:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace}
        body{background:var(--bg);font-family:var(--font);color:var(--text)}
        .page{max-width:680px;margin:0 auto;padding:40px 24px 80px}
        .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:13px;text-decoration:none;margin-bottom:28px}
        .back-link:hover{color:var(--text-2)}
        .page-title{font-size:22px;font-weight:600;letter-spacing:-0.4px;margin-bottom:4px}
        .page-sub{font-size:13px;color:var(--text-2);margin-bottom:32px}
        .section{background:var(--surface);border:0.5px solid var(--border);border-radius:14px;margin-bottom:16px;overflow:hidden}
        .section-header{padding:16px 20px;border-bottom:0.5px solid var(--border)}
        .section-title{font-size:14px;font-weight:500}
        .section-sub{font-size:12px;color:var(--text-3);margin-top:2px}
        .setting-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:0.5px solid var(--border)}
        .setting-row:last-child{border-bottom:none}
        .setting-label{font-size:13px;font-weight:500}
        .setting-desc{font-size:12px;color:var(--text-3);margin-top:2px}
        .toggle{position:relative;width:36px;height:20px;flex-shrink:0}
        .toggle input{opacity:0;width:0;height:0}
        .toggle-track{position:absolute;inset:0;border-radius:10px;background:var(--border2);transition:background 0.2s;cursor:pointer}
        .toggle input:checked + .toggle-track{background:#2563eb}
        .toggle-thumb{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:white;transition:transform 0.2s;pointer-events:none}
        .toggle input:checked ~ .toggle-thumb{transform:translateX(16px)}
        .select{background:var(--surface2);border:0.5px solid var(--border2);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--text);font-family:var(--font);outline:none;cursor:pointer}
        .env-row{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:0.5px solid var(--border)}
        .env-row:last-child{border-bottom:none}
        .env-key{font-size:12px;font-family:var(--mono);color:var(--text-2)}
        .env-status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px}
        .env-set{background:rgba(16,185,129,0.1);color:#10b981}
        .env-missing{background:rgba(239,68,68,0.1);color:#ef4444}
        .footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;font-family:var(--font);transition:all 0.15s}
        .btn-primary{background:#2563eb;color:white}
        .btn-primary:hover{background:#1d4ed8}
        .btn-success{background:rgba(16,185,129,0.15);color:#10b981;border:0.5px solid rgba(16,185,129,0.2)}
      `}</style>

      <div className="page">
        <Link href="/dashboard" className="back-link"><IconArrowLeft /> Back to Dashboard</Link>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Configure ScopeGuard gateway behavior and demo settings.</p>

        {/* CIBA settings */}
        <div className="section">
          <div className="section-header">
            <div className="section-title">Step-Up Authentication</div>
            <div className="section-sub">Configure CIBA approval behavior</div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Auto-approve in demo mode</div>
              <div className="setting-desc">When enabled, step-up requests are automatically approved (CIBA_MOCK_AUTO_APPROVE=true)</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Step-up mode</div>
              <div className="setting-desc">Current mode based on CIBA_MOCK_AUTO_APPROVE env variable</div>
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: autoApprove ? '#10b981' : '#ef4444', background: autoApprove ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 20 }}>
              {autoApprove ? 'AUTO-APPROVE' : 'AUTO-DENY'}
            </span>
          </div>
        </div>

        {/* Dashboard settings */}
        <div className="section">
          <div className="section-header">
            <div className="section-title">Dashboard</div>
            <div className="section-sub">Live monitoring preferences</div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Auto-refresh interval</div>
              <div className="setting-desc">How often the dashboard polls for new events during demo</div>
            </div>
            <select className="select" value={refreshInterval} onChange={e => setRefreshInterval(e.target.value)}>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
          </div>
        </div>

        {/* Environment */}
        <div className="section">
          <div className="section-header">
            <div className="section-title">Environment Configuration</div>
            <div className="section-sub">Required environment variables</div>
          </div>
          {[
            'AUTH0_ISSUER_BASE_URL',
            'AUTH0_CLIENT_ID',
            'AUTH0_AUDIENCE',
            'AGENT_TRAVEL_CLIENT_ID',
            'GOOGLE_GENERATIVE_AI_API_KEY',
            'SCOPEGUARD_GATEWAY_SECRET',
          ].map(key => (
            <div key={key} className="env-row">
              <span className="env-key">{key}</span>
              <span className="env-status env-set">configured</span>
            </div>
          ))}
        </div>

        <div className="footer">
          <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={save}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}