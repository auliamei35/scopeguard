// src/app/page.tsx
import Link from 'next/link';

// SVG Icons
const ShieldIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const PlaneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5c-1.5-1.5-3.5-1.5-5 0L11 6 2.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L8 11l-3 3H2l-1 1 4 2 2 4 1-1v-3l3-3 4.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </svg>
);
const AlertTriangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const BuildingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const BriefcaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function LandingPage() {
  const AGENTS = [
    { id: 'travel-booking-agent-v1', label: 'Travel Booking', icon: <PlaneIcon />, color: '#3b82f6', max: '$1,000', approval: '$200', status: 'Active' },
    { id: 'fraud-detection-agent-v1', label: 'Fraud Detection', icon: <AlertTriangleIcon />, color: '#ef4444', max: '$5,000', approval: '$1,000', status: 'Active' },
    { id: 'aml-compliance-agent-v1', label: 'AML Compliance', icon: <BuildingIcon />, color: '#f59e0b', max: '$100,000', approval: '$50,000', status: 'Active' },
    { id: 'hr-onboarding-agent-v1', label: 'HR Onboarding', icon: <BriefcaseIcon />, color: '#10b981', max: '$0', approval: 'N/A', status: 'Active' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#060910;--bg-1:#0d1117;--bg-2:#111827;--bg-3:#1a2235;
          --border:rgba(255,255,255,0.05);--border-1:rgba(255,255,255,0.09);--border-2:rgba(255,255,255,0.14);
          --blue:#2563eb;--blue-1:#3b82f6;--blue-2:#60a5fa;
          --text:#f1f5f9;--text-1:#cbd5e1;--text-2:#94a3b8;--text-3:#64748b;
          --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;--font-mono:'JetBrains Mono',monospace;
        }
        body{background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased;}
        a{text-decoration:none;color:inherit;}
        @keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(37,99,235,0.2)}50%{box-shadow:0 0 40px rgba(37,99,235,0.4)}}
        .hero-badge{animation:fade-up 0.5s ease both}
        .hero-title{animation:fade-up 0.5s 0.1s ease both}
        .hero-sub{animation:fade-up 0.5s 0.2s ease both}
        .hero-actions{animation:fade-up 0.5s 0.3s ease both}
        .hero-stats{animation:fade-up 0.5s 0.4s ease both}
        .card{animation:fade-up 0.5s ease both}
        .btn-primary:hover{background:#1d4ed8;transform:translateY(-1px)}
        .btn-secondary:hover{background:var(--bg-3);border-color:var(--border-2);}
        .agent-card:hover{border-color:var(--border-2);transform:translateY(-2px);}
        .nav-link:hover{color:var(--text-1);}
      `}</style>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 32px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(6,9,16,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            <ShieldIcon size={16} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
            ScopeGuard
          </span>
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[['Dashboard', '/dashboard'], ['Agents', '/consent'], ['Insights', '/insights']].map(([label, href]) => (
            <Link key={label} href={href} className="nav-link" style={{ fontSize: 13, color: 'var(--text-2)', transition: 'color 0.15s' }}>
              {label}
            </Link>
          ))}
          <Link href="/ask" style={{
            background: 'var(--blue)', color: '#fff',
            padding: '7px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500,
            transition: 'background 0.15s',
          }}>
            Try Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px 60px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
          pointerEvents: 'none',
        }} />
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <div className="hero-badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(37,99,235,0.08)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: 20, padding: '6px 14px',
          marginBottom: 28,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#60a5fa', fontFamily: 'var(--font-mono)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Auth0 Token Vault · CIBA · Gemini 2.5
          </span>
        </div>

        {/* Title */}
        <h1 className="hero-title" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 800,
          letterSpacing: '-2px',
          lineHeight: 1.1,
          marginBottom: 20,
          maxWidth: 820,
        }}>
          An AI agent can ask.{' '}
          <span style={{ color: '#3b82f6' }}>ScopeGuard</span>{' '}
          decides what it may actually do.
        </h1>

        {/* Subtitle */}
        <p className="hero-sub" style={{
          fontSize: 18,
          color: 'var(--text-2)',
          lineHeight: 1.65,
          maxWidth: 560,
          marginBottom: 36,
        }}>
          Dynamic permission negotiator for AI agents.
          No blank-check tokens. Every action verified before and after execution.
        </p>

        {/* CTA buttons */}
        <div className="hero-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 56 }}>
          <Link href="/ask" className="btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#2563eb', color: '#fff',
            padding: '13px 24px', borderRadius: 10,
            fontSize: 15, fontWeight: 500,
            transition: 'all 0.15s',
          }}>
            Try the Travel Agent Demo <ArrowRight />
          </Link>
          <Link href="/dashboard" className="btn-secondary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent',
            border: '1px solid var(--border-1)',
            color: 'var(--text-1)',
            padding: '13px 24px', borderRadius: 10,
            fontSize: 15, fontWeight: 500,
            transition: 'all 0.15s',
          }}>
            Open Dashboard <ArrowRight />
          </Link>
        </div>

        {/* Stats */}
        <div className="hero-stats" style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            ['88%', 'of orgs had AI security incidents (Gravitee 2026)'],
            ['4 Layers', 'pre + post-execution verification'],
            ['0 false', 'positives in PII detection'],
          ].map(([num, label]) => (
            <div key={num} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-1px' }}>{num}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, maxWidth: 140 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Feature Cards */}
      <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {[
            {
              icon: <UserIcon />, color: '#3b82f6',
              title: 'User Flow',
              desc: 'User → Agent → ScopeGuard → CIBA approval → Token Vault → API. Every action needs explicit permission.',
              items: ['Agent sends tool call', 'L1-L2-L3 validates and minimizes scope', 'User approves via CIBA if high-stakes', 'Short-lived token issued (300s)'],
              link: '/ask', linkLabel: 'Try the demo',
            },
            {
              icon: <LockIcon />, color: '#ef4444',
              title: 'Security',
              desc: 'Four-layer defense. Hard constraints run as pure code — LLM cannot override them.',
              items: ['Amount ceiling enforced (non-LLM)', 'Domain whitelist, velocity cap', 'Multi-layer PII: Regex → Context → Luhn', 'Post-execution output verification'],
              link: '/rules', linkLabel: 'View security rules',
            },
            {
              icon: <ActivityIcon />, color: '#10b981',
              title: 'Audit Trail',
              desc: 'Every action produces a structured audit record with scopes granted vs actually used.',
              items: ['Real-time activity feed', 'Scopes granted → scopes used (reduction %)', 'L4 verification status per execution', 'CSV export for compliance'],
              link: '/activity', linkLabel: 'View activity log',
            },
          ].map(({ icon, color, title, desc, items, link, linkLabel }, i) => (
            <div key={title} className="card" style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 28,
              animationDelay: `${i * 0.1}s`,
              transition: 'border-color 0.2s',
            }}>
              <div style={{
                width: 44, height: 44,
                borderRadius: 12,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color,
                marginBottom: 16,
              }}>
                {icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>{desc}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {items.map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-1)' }}>
                    <span style={{ color, flexShrink: 0, marginTop: 1 }}><CheckCircleIcon /></span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={link} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, color,
              }}>
                {linkLabel} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Cards */}
      <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Registered Agents
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            Each agent has its own identity, hard limits, and security profile. No shared credentials.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {AGENTS.map(({ id, label, icon, color, max, approval, status }, i) => (
            <div key={id} className="agent-card" style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 20,
              transition: 'all 0.2s',
              animation: `fade-up 0.5s ${i * 0.07}s ease both`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${color}18`, border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    {id.split('-').slice(0, 2).join('-')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {[
                  ['Max amount', max],
                  ['Requires approval', approval],
                  ['Status', status],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>{k}</span>
                    <span style={{ color: v === 'Active' ? '#10b981' : 'var(--text-1)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <Link href={`/ask?agent=${id}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: `${color}12`, border: `1px solid ${color}25`,
                color, borderRadius: 8,
                padding: '8px 0', fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}>
                Try this agent <ArrowRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* User Personas */}
      <section style={{ padding: '0 24px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Who Uses ScopeGuard
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            {
              persona: 'End User',
              example: 'Business owner, employee, customer',
              color: '#3b82f6',
              story: 'You ask the travel agent to book a $500 flight to Tokyo. ScopeGuard checks the request, Gemini analyzes what permissions are actually needed, and you receive an approval notification — in plain English, not OAuth scope strings. One tap to confirm.',
              flow: ['Request: "Book flight to Tokyo $500"', 'ScopeGuard validates agent identity', 'Gemini determines: payment:write + email:send only', 'Approval notification: "Book flight for $500 — confirm?"', 'Token issued (expires in 300s)', 'Flight booked — confirmation email sent'],
            },
            {
              persona: 'Security / Ops',
              example: 'SOC analyst, compliance officer, DevOps',
              color: '#10b981',
              story: 'An agent attempts a $10,000 payment to an unrecognized domain. ScopeGuard blocks it in Layer 2 before the LLM is even consulted. The audit log records the violation with full context: agent ID, tool, amount, domain, and the hard constraint that prevented it.',
              flow: ['Agent attempts $10,000 to api.unknown.com', 'L1: Agent identity verified', 'L2: AMOUNT_CEILING + DOMAIN_VIOLATION → blocked', 'Audit log: violations recorded', 'Security dashboard: alert surfaced', 'No execution — no damage'],
            },
          ].map(({ persona, example, color, story, flow }) => (
            <div key={persona} style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: 28,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  background: `${color}18`, color,
                  fontSize: 11, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 20,
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {persona}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{example}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.7, marginBottom: 20 }}>{story}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {flow.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}20`, border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{i + 1}</div>
                      {i < flow.length - 1 && <div style={{ width: 1.5, flex: 1, background: `${color}20`, minHeight: 16, marginTop: 2 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', paddingBottom: 12, paddingTop: 3, lineHeight: 1.5 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--text-3)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-2)' }}>ScopeGuard</span>
        <span>Built for Authorized to Act · Auth0 for AI Agents Hackathon · April 2026</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['GitHub', 'https://github.com'], ['Auth0 Docs', 'https://auth0.com/ai'], ['Devpost', 'https://authorizedtoact.devpost.com']].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener" style={{ color: 'var(--text-3)', transition: 'color 0.15s' }}>{label}</a>
          ))}
        </div>
      </footer>
    </>
  );
}