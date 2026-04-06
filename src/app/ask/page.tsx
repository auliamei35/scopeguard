// src/app/ask/page.tsx
'use client';

import { memo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AGENTS, AgentConfig, AgentPreset } from '@/config/agents';
import { useScopeGuardRunner } from '@/hooks/useScopeGuardRunner';
import { TimelineStep, RunResult, StepStatus } from '@/types/timeline';

// ── Icons (memoised — never re-render unless props change) ────────────────────

const BackIcon = memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
));
BackIcon.displayName = 'BackIcon';

const CheckIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
));
CheckIcon.displayName = 'CheckIcon';

const XIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
));
XIcon.displayName = 'XIcon';

// Map layer id → icon SVG path data (avoids a component per icon)
const LAYER_ICONS: Record<string, string> = {
  l1:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',                      // shield
  l2:   'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4',  // alert
  l3:   'M4 4h16v16H4z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3 M20 9h3 M20 14h3 M1 9h3 M1 14h3', // cpu (simplified)
  ciba: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4', // key
  tv:   'M13 2 3 14h9l-1 8 10-12h-9l1-8z',                                   // zap
  exec: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', // box
  l4:   'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01 9 11.01',        // check-circle
};

const LayerIcon = memo(({ id }: { id: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={LAYER_ICONS[id] ?? ''} />
  </svg>
));
LayerIcon.displayName = 'LayerIcon';

// ── Status colour map ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: '#475569',
  running: '#3b82f6',
  success: '#10b981',
  error:   '#ef4444',
  warning: '#f59e0b',
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface AgentSelectorProps {
  agents: AgentConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}
const AgentSelector = memo(({ agents, selectedId, onSelect }: AgentSelectorProps) => (
  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
      Select Agent
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {agents.map(a => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${selectedId === a.id ? a.color + '40' : 'var(--border)'}`,
            background: selectedId === a.id ? `${a.color}10` : 'transparent',
            color: selectedId === a.id ? 'var(--text)' : 'var(--text-2)',
            textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0,
            boxShadow: selectedId === a.id ? `0 0 6px ${a.color}` : 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: selectedId === a.id ? 500 : 400 }}>{a.label}</span>
        </button>
      ))}
    </div>
  </div>
));
AgentSelector.displayName = 'AgentSelector';

interface PresetListProps {
  presets: AgentPreset[];
  running: boolean;
  onRun: (preset: AgentPreset) => void;
}
const PresetList = memo(({ presets, running, onRun }: PresetListProps) => (
  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
      Quick Scenarios
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {presets.map(preset => (
        <button
          key={preset.label}
          onClick={() => onRun(preset)}
          disabled={running}
          style={{
            padding: '10px 14px', borderRadius: 9,
            border: '1px solid var(--border-1)',
            background: 'transparent', color: 'var(--text)',
            fontSize: 12, textAlign: 'left',
            cursor: running ? 'not-allowed' : 'pointer',
            opacity: running ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  </div>
));
PresetList.displayName = 'PresetList';

const ResultPanel = memo(({ result }: { result: RunResult }) => (
  <div style={{
    background: 'var(--bg-2)',
    border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    borderRadius: 14, padding: 18, animation: 'fade-up 0.3s ease',
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
      Result
    </div>
    {result.success ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
            Success
          </span>
          {result.stepUpCompleted && (
            <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
              Step-up completed
            </span>
          )}
        </div>
        {result.scopeDecision && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)' }}>Scopes used: </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>
                {result.scopeDecision.minimalScopes.join(', ') || 'none'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)' }}>Risk: </span>
              <span style={{ textTransform: 'capitalize', color: ['high','critical'].includes(result.scopeDecision.riskLevel) ? '#f87171' : result.scopeDecision.riskLevel === 'medium' ? '#fbbf24' : '#34d399' }}>
                {result.scopeDecision.riskLevel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8, borderLeft: '2px solid #3b82f6' }}>
              {result.scopeDecision.explanation}
            </div>
          </>
        )}
        {result.verification && (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)' }}>L4 output: </span>
            <span style={{ color: result.verification.status === 'clean' ? '#34d399' : '#f87171', fontWeight: 500 }}>
              {result.verification.status}
            </span>
            <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>({result.verification.executionMs}ms)</span>
          </div>
        )}
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
          Blocked
        </span>
        <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>{result.error}</div>
        {result.violations?.map((v, i) => (
          <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', padding: '6px 8px', background: 'rgba(239,68,68,0.05)', borderRadius: 6, borderLeft: '2px solid #ef4444' }}>
            {v.split(':')[0]}
          </div>
        ))}
      </div>
    )}
  </div>
));
ResultPanel.displayName = 'ResultPanel';

interface TimelineItemProps {
  step: TimelineStep;
  index: number;
  total: number;
}
const TimelineItem = memo(({ step, index, total }: TimelineItemProps) => {
  const color = STATUS_COLOR[step.status];
  return (
    <div className="step-item" style={{ display: 'flex', gap: 14, animationDelay: `${index * 0.05}s` }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${color}18`, border: `1.5px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, flexShrink: 0,
        }}>
          {step.status === 'success' ? <CheckIcon /> : step.status === 'error' ? <XIcon /> : <LayerIcon id={step.id} />}
        </div>
        {index < total - 1 && (
          <div style={{ width: 1.5, flex: 1, background: color + '30', minHeight: 20, marginTop: 4, marginBottom: 4 }} />
        )}
      </div>
      <div style={{ paddingBottom: index < total - 1 ? 20 : 0, paddingTop: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color, background: `${color}15`, padding: '2px 7px', borderRadius: 4 }}>
            {step.layer}
          </span>
          <span
            style={{ fontSize: 13, fontWeight: 500, color: step.status === 'pending' ? 'var(--text-3)' : 'var(--text)' }}
            className={step.status === 'running' ? 'timeline-running' : ''}
          >
            {step.label}
          </span>
        </div>
        {step.detail && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{step.detail}</div>
        )}
      </div>
    </div>
  );
});
TimelineItem.displayName = 'TimelineItem';

// ── Main inner page ───────────────────────────────────────────────────────────

function AskPageInner() {
  const searchParams = useSearchParams();
  const defaultAgentId = searchParams.get('agent') ?? AGENTS[0].id;

  // Single useState for selected agent — everything else lives in the reducer
  const [selectedAgentId, setSelectedAgentId] = React.useState(defaultAgentId);
  const { state, run, reset } = useScopeGuardRunner(selectedAgentId);

  const agent = AGENTS.find(a => a.id === selectedAgentId) ?? AGENTS[0];

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    reset();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#060910;--bg-1:#0d1117;--bg-2:#111827;--bg-3:#1a2235;
          --border:rgba(255,255,255,0.05);--border-1:rgba(255,255,255,0.09);--border-2:rgba(255,255,255,0.14);
          --text:#f1f5f9;--text-2:#94a3b8;--text-3:#64748b;
          --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;--font-mono:'JetBrains Mono',monospace
        }
        body{background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased;}
        textarea{resize:none;outline:none;}
        select{outline:none;appearance:none;cursor:pointer;}
        button{cursor:pointer;font-family:var(--font-body);}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .step-item{animation:fade-up 0.3s ease both}
        .timeline-running::after{content:'';display:inline-block;width:10px;height:10px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;margin-left:8px;vertical-align:middle}
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 960, margin: '0 auto', padding: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none' }}>
            <BackIcon /> Home
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
              Agent Simulator
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>
              See every layer of ScopeGuard in action — real gateway, real verification
            </p>
          </div>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', padding: '7px 14px', border: '1px solid var(--border-1)', borderRadius: 8 }}>
            Dashboard
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, flex: 1 }}>

          {/* Left panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AgentSelector
              agents={AGENTS}
              selectedId={selectedAgentId}
              onSelect={handleSelectAgent}
            />
            <PresetList
              presets={agent.presets}
              running={state.running}
              onRun={run}
            />
            {state.result && <ResultPanel result={state.result} />}
          </div>

          {/* Right: Timeline */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Execution Timeline</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Real-time layer-by-layer trace</div>
              </div>
              {state.running && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3b82f6' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
                  Processing
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {state.timeline.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: 10 }}>
                  <div style={{ fontSize: 13 }}>Select a scenario to see ScopeGuard in action</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>Each step runs in real-time through the actual gateway</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {state.timeline.map((step, i) => (
                    <TimelineItem key={step.id} step={step} index={i} total={state.timeline.length} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Need React in scope for useState
import React from 'react';

export default function AskPage() {
  return (
    <Suspense>
      <AskPageInner />
    </Suspense>
  );
}