// src/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0e1a; --surface: #111827; --surface2: #1a2235;
          --border: rgba(255,255,255,0.06); --border2: rgba(255,255,255,0.12);
          --blue: #2563eb; --green: #10b981; --orange: #f59e0b;
          --text: #f1f5f9; --text-2: #94a3b8; --text-3: #475569;
          --font: 'DM Sans', sans-serif; --mono: 'JetBrains Mono', monospace;
        }
        body { background: var(--bg); font-family: var(--font); color: var(--text); min-height: 100vh; }
        .page { max-width: 640px; margin: 0 auto; padding: 64px 24px 80px; }
        .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(37,99,235,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 20px; padding: 5px 12px; font-size: 11px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.6px; font-family: var(--mono); margin-bottom: 20px; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; }
        h1 { font-size: 36px; font-weight: 600; letter-spacing: -1px; line-height: 1.15; margin-bottom: 14px; }
        .sub { font-size: 16px; color: var(--text-2); line-height: 1.65; margin-bottom: 36px; }
        .layers { display: flex; flex-direction: column; gap: 8px; margin-bottom: 36px; }
        .layer { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--surface); border: 0.5px solid var(--border); border-radius: 12px; transition: border-color 0.15s; }
        .layer:hover { border-color: var(--border2); }
        .layer-num { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: var(--mono); flex-shrink: 0; }
        .layer-text { flex: 1; }
        .layer-title { font-size: 14px; font-weight: 500; margin-bottom: 2px; }
        .layer-desc { font-size: 12px; color: var(--text-3); }
        .layer-tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; font-family: var(--mono); flex-shrink: 0; }
        .impact-bar { background: rgba(37,99,235,0.07); border: 1px solid rgba(59,130,246,0.15); border-radius: 12px; padding: 16px 18px; margin-bottom: 28px; }
        .impact-title { font-size: 11px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }
        .impact-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .impact-stat { text-align: center; }
        .impact-num { font-size: 20px; font-weight: 700; font-family: var(--mono); color: #f97316; }
        .impact-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }
        .nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .nav-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 500; text-decoration: none; transition: all 0.15s; text-align: center; }
        .nav-primary { background: var(--blue); color: white; }
        .nav-primary:hover { background: #1d4ed8; }
        .nav-secondary { background: var(--surface); color: var(--text-2); border: 0.5px solid var(--border2); }
        .nav-secondary:hover { background: var(--surface2); color: var(--text); }
      `}</style>

      <div className="page">
        <div className="badge"><span className="badge-dot" />Auth0 Token Vault · CIBA · M2M</div>

        <h1>ScopeGuard</h1>
        <p className="sub">
          LLM-driven dynamic permission negotiator for AI agents.
          Three defense layers ensure agents only get the permissions they actually need —
          not a blank check.
        </p>

        {/* Impact bar */}
        <div className="impact-bar">
          <div className="impact-title">Why this matters — Gravitee 2026 Report (n=919)</div>
          <div className="impact-stats">
            <div className="impact-stat">
              <div className="impact-num">88%</div>
              <div className="impact-label">orgs had security incidents</div>
            </div>
            <div className="impact-stat">
              <div className="impact-num">78%</div>
            </div>
            <div className="impact-stat">
              <div className="impact-num">45.6%</div>
              <div className="impact-label">still use shared API keys</div>
            </div>
          </div>
        </div>

        {/* Layers */}
        <div className="layers">
          {[
            { num: 'L1', title: 'Agent Identity', desc: 'Auth0 M2M — every agent has its own identity, not a shared key', color: '#3b82f6', tag: 'Auth0 M2M', tagBg: 'rgba(59,130,246,0.12)', tagColor: '#60a5fa' },
            { num: 'L2', title: 'Hard Constraints', desc: 'Amount ceiling, domain whitelist, velocity cap — pure code, LLM-proof', color: '#ef4444', tag: 'Non-LLM', tagBg: 'rgba(239,68,68,0.12)', tagColor: '#f87171' },
            { num: 'L3', title: 'LLM Intent Analyzer', desc: 'Gemini determines minimal scope per action — not the full declared set', color: '#f59e0b', tag: 'Gemini', tagBg: 'rgba(245,158,11,0.12)', tagColor: '#fbbf24' },
            { num: 'SU', title: 'CIBA Step-Up', desc: 'High-stakes actions pause for explicit human approval before proceeding', color: '#10b981', tag: 'Auth0 CIBA', tagBg: 'rgba(16,185,129,0.12)', tagColor: '#34d399' },
          ].map(({ num, title, desc, color, tag, tagBg, tagColor }) => (
            <div key={num} className="layer">
              <div className="layer-num" style={{ background: `${color}15`, color }}>{num}</div>
              <div className="layer-text">
                <div className="layer-title">{title}</div>
                <div className="layer-desc">{desc}</div>
              </div>
              <span className="layer-tag" style={{ background: tagBg, color: tagColor }}>{tag}</span>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="nav-grid">
          <Link href="/dashboard" className="nav-btn nav-primary">Open Dashboard</Link>
          <Link href="/consent" className="nav-btn nav-secondary">View Permissions</Link>
          <Link href="/insights" className="nav-btn nav-secondary">Security Insights</Link>
          <a href="https://github.com" className="nav-btn nav-secondary" target="_blank" rel="noopener">GitHub Repo</a>
        </div>
      </div>
    </>
  );
}