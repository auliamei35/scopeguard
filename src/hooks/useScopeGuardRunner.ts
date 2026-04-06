// src/hooks/useScopeGuardRunner.ts
'use client';

import { useReducer, useCallback, useRef } from 'react';
import {
  runnerReducer,
  initialRunnerState,
  TimelineStep,
  RunResult,
} from '@/types/timeline';
import type { AgentPreset } from '@/config/agents';

// Layer definitions — single source of truth for timeline shape
const LAYER_DEFINITIONS: Omit<TimelineStep, 'status'>[] = [
  { id: 'l1',   layer: 'L1',         label: 'Verifying agent identity'     },
  { id: 'l2',   layer: 'L2',         label: 'Checking hard constraints'    },
  { id: 'l3',   layer: 'L3',         label: 'Gemini analyzes minimal scope'},
  { id: 'ciba', layer: 'CIBA',       label: 'Step-up approval'             },
  { id: 'tv',   layer: 'Token Vault',label: 'Issuing scoped token'         },
  { id: 'exec', layer: 'Tool',       label: '' /* filled at runtime */     },
  { id: 'l4',   layer: 'L4',         label: 'Verifying output'             },
];

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function useScopeGuardRunner(agentId: string) {
  const [state, dispatch] = useReducer(runnerReducer, initialRunnerState);
  // Guard against stale closures on rapid clicks
  const abortRef = useRef(false);

  const update = useCallback(
    (id: string, update: Partial<TimelineStep>) =>
      dispatch({ type: 'UPDATE_STEP', id, update }),
    []
  );

  const run = useCallback(
    async (preset: AgentPreset) => {
      if (state.running) return;
      abortRef.current = false;

      // Initialise fresh timeline
      const steps: TimelineStep[] = LAYER_DEFINITIONS.map(def => ({
        ...def,
        label: def.id === 'exec' ? `Executing ${preset.tool}` : def.label,
        status: 'pending',
      }));
      dispatch({ type: 'INIT_STEPS', steps });

      try {
        // ── Fetch token ────────────────────────────────────────────────────
        const tokenRes = await fetch('/api/demo/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId }),
        });
        if (!tokenRes.ok) throw new Error('Token fetch failed');
        const { token } = await tokenRes.json();

        if (abortRef.current) return;

        // ── L1 ─────────────────────────────────────────────────────────────
        update('l1', { status: 'running' });
        await sleep(400);
        update('l1', { status: 'success', detail: `Agent: ${agentId}` });

        // ── L2 (kick off — result comes from API) ──────────────────────────
        update('l2', { status: 'running' });
        await sleep(300);

        // ── Execute ────────────────────────────────────────────────────────
        const res = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            toolCall: { name: preset.tool, params: preset.params, requiredConnection: 'mock' },
          }),
        });

        if (abortRef.current) return;

        const data = (await res.json()) as RunResult & {
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          applyErrorPath(data, update);
          dispatch({
            type: 'SET_RESULT',
            result: {
              success: false,
              error: data.message,
              violations: data.violations,
            },
          });
          return;
        }

        // ── Happy path ─────────────────────────────────────────────────────
        await applySuccessPath(data, preset, update, abortRef);
        dispatch({ type: 'SET_RESULT', result: data });
      } catch (err) {
        // Network / parse errors — surface cleanly
        const message = err instanceof Error ? err.message : 'Unknown error';
        dispatch({
          type: 'SET_RESULT',
          result: { success: false, error: `Network error: ${message}` },
        });
      } finally {
        dispatch({ type: 'SET_RUNNING', running: false });
      }
    },
    [state.running, agentId, update]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    dispatch({ type: 'RESET' });
  }, []);

  return { state, run, reset };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyErrorPath(
  data: RunResult & { error?: string },
  update: (id: string, u: Partial<TimelineStep>) => void
) {
  const errCode = data.error ?? 'ERROR';

  if (errCode === 'HARD_CONSTRAINT_VIOLATION') {
    // Gunakan data.violations secara aman
    const detailMessage = data.violations?.[0]?.split(':')[0] ?? 'Unknown Violation';
    
    update('l2',   { status: 'error',   detail: detailMessage });
    update('l3',   { status: 'error',   detail: 'Blocked before LLM reached' });
    update('ciba', { status: 'error',   detail: 'Not reached' });
    update('tv',   { status: 'error',   detail: 'Not reached' });
    update('exec', { status: 'error',   detail: 'Execution prevented' });
    update('l4',   { status: 'error',   detail: 'Not reached' });
  } else if (errCode === 'STEPUP_DENIED') {
    update('l2',   { status: 'success', detail: 'Passed' });
    update('l3',   { status: 'success', detail: 'Scope decided' });
    update('ciba', { status: 'error',   detail: 'User denied' });
    update('tv',   { status: 'error',   detail: 'Not reached' });
    update('exec', { status: 'error',   detail: 'Prevented by user' });
    update('l4',   { status: 'error',   detail: 'Not reached' });
  } else {
    update('l2', { status: 'error', detail: errCode });
  }
}

async function applySuccessPath(
  data: RunResult,
  preset: AgentPreset,
  update: (id: string, u: Partial<TimelineStep>) => void,
  abortRef: React.MutableRefObject<boolean>
) {
  const guard = () => abortRef.current;

  update('l2', { status: 'success', detail: 'All constraints passed' });
  await sleep(200); if (guard()) return;

  update('l3', { status: 'running' });
  await sleep(600); if (guard()) return;
  const sd = data.scopeDecision;
  update('l3', {
    status: 'success',
    detail: sd ? `${sd.minimalScopes.length} scope(s) — ${sd.riskLevel} risk` : 'Decided',
  });
  await sleep(200); if (guard()) return;

  if (data.stepUpCompleted) {
    update('ciba', { status: 'running' });
    await sleep(1500); if (guard()) return;
    update('ciba', { status: 'success', detail: 'Approved by user' });
  } else {
    update('ciba', { status: 'success', detail: 'Not required' });
  }
  await sleep(200); if (guard()) return;

  update('tv', { status: 'running' });
  await sleep(300); if (guard()) return;
  update('tv', { status: 'success', detail: 'Issued — expires in 300s' });
  await sleep(200); if (guard()) return;

  update('exec', { status: 'running' });
  await sleep(400); if (guard()) return;
  update('exec', { status: 'success', detail: `${preset.tool} completed` });
  await sleep(200); if (guard()) return;

  update('l4', { status: 'running' });
  await sleep(300); if (guard()) return;
  const v = data.verification;
  update('l4', {
    status: v?.status === 'clean' ? 'success' : v?.status === 'quarantined' ? 'error' : 'warning',
    detail: v ? `${v.status} — ${v.executionMs}ms` : 'clean',
  });
}