// src/hooks/useApprovalPoller.ts
// Polls GET /api/approve?id=xxx every 2s until resolved or timeout
// Used by /ask page's CIBA step to wait for user decision from /approvals

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ApprovalStatus, PollResponse } from '@/types/approvals';

interface PollState {
  status: ApprovalStatus | null;
  loading: boolean;
  error: string | null;
}

interface UseApprovalPollerOptions {
  /** Approval request ID to poll. Set to null to pause polling. */
  requestId: string | null;
  /** Polling interval in ms (default: 2000) */
  intervalMs?: number;
  /** Max time to poll before giving up in ms (default: 5 minutes) */
  timeoutMs?: number;
  /** Called when status becomes non-pending */
  onResolved?: (status: ApprovalStatus) => void;
}

export function useApprovalPoller({
  requestId,
  intervalMs = 2000,
  timeoutMs = 5 * 60 * 1000,
  onResolved,
}: UseApprovalPollerOptions): PollState & { reset: () => void } {
  const [state, setState] = useState<PollState>({ status: null, loading: false, error: null });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setState({ status: null, loading: false, error: null });
  }, [stop]);

  useEffect(() => {
    if (!requestId) {
      reset();
      return;
    }

    startedAt.current = Date.now();
    setState({ status: null, loading: true, error: null });

    const poll = async () => {
      // Timeout guard
      if (Date.now() - startedAt.current > timeoutMs) {
        stop();
        setState({ status: 'expired', loading: false, error: 'Approval timed out' });
        onResolvedRef.current?.('expired');
        return;
      }

      try {
        const res = await fetch(`/api/approve?id=${requestId}`);
        if (!res.ok) {
          const { error } = await res.json();
          setState(s => ({ ...s, error: error ?? 'Poll failed', loading: false }));
          stop();
          return;
        }
        const data: PollResponse = await res.json();
        setState({ status: data.status, loading: false, error: null });

        if (data.status !== 'pending') {
          stop();
          onResolvedRef.current?.(data.status);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setState(s => ({ ...s, error: msg, loading: false }));
        // Don't stop — retry on next interval for transient errors
      }
    };

    poll(); // immediate first check
    timerRef.current = setInterval(poll, intervalMs);

    return stop;
  }, [requestId, intervalMs, timeoutMs, stop, reset]);

  return { ...state, reset };
}