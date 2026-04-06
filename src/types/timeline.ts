// src/types/timeline.ts
export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'warning';

export interface TimelineStep {
  id: string;
  layer: string;
  label: string;
  detail?: string;
  status: StepStatus;
}

export type RunResult = {
  success: boolean;
  error?: string;
  violations?: string[];
  scopeDecision?: {
    minimalScopes: string[];
    riskLevel: string;
    explanation: string;
    reversible: boolean;
  };
  verification?: {
    status: string;
    violations: number;
    executionMs: number;
  };
  stepUpCompleted?: boolean;
  result?: unknown;
};

// ── Reducer ──────────────────────────────────────────────────────────────────

export type RunnerAction =
  | { type: 'RESET' }
  | { type: 'INIT_STEPS'; steps: TimelineStep[] }
  | { type: 'UPDATE_STEP'; id: string; update: Partial<TimelineStep> }
  | { type: 'SET_RESULT'; result: RunResult }
  | { type: 'SET_RUNNING'; running: boolean };

export interface RunnerState {
  running: boolean;
  timeline: TimelineStep[];
  result: RunResult | null;
}

export const initialRunnerState: RunnerState = {
  running: false,
  timeline: [],
  result: null,
};

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'RESET':
      return initialRunnerState;

    case 'INIT_STEPS':
      return { ...state, running: true, timeline: action.steps, result: null };

    case 'UPDATE_STEP':
      return {
        ...state,
        timeline: state.timeline.map(s =>
          s.id === action.id ? { ...s, ...action.update } : s
        ),
      };

    case 'SET_RESULT':
      return { ...state, result: action.result };

    case 'SET_RUNNING':
      return { ...state, running: action.running };

    default:
      return state;
  }
}