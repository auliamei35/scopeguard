// src/components/Toast.tsx
'use client';
import {
  createContext, useContext, useState, useCallback,
  useRef, useEffect, useReducer,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;        // Configurable duration (ms). 0 = persist.
  action?: ToastAction;     // action button (Undo / Retry / etc.)
}

interface ToastEntry extends ToastOptions {
  id: string;
  paused: boolean;          // Hover pause state
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  success: (title: string, message?: string, action?: ToastAction) => string;
  error:   (title: string, message?: string, action?: ToastAction) => string;
  warning: (title: string, message?: string, action?: ToastAction) => string;
  info:    (title: string, message?: string, action?: ToastAction) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ── Reducer — explicit queue strategy ────────────────────────────────

type QueueAction =
  | { type: 'ADD';    entry: ToastEntry }
  | { type: 'REMOVE'; id: string }
  | { type: 'PAUSE';  id: string }
  | { type: 'RESUME'; id: string }
  | { type: 'CLEAR' };

const MAX_VISIBLE = 5;

function queueReducer(state: ToastEntry[], action: QueueAction): ToastEntry[] {
  switch (action.type) {
    case 'ADD':
      // FIFO: if at cap, drop the oldest non-persistent toast
      if (state.length >= MAX_VISIBLE) {
        const dropIdx = state.findIndex(t => (t.duration ?? 4000) > 0);
        if (dropIdx !== -1) {
          return [...state.slice(0, dropIdx), ...state.slice(dropIdx + 1), action.entry];
        }
      }
      return [...state, action.entry];
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    case 'PAUSE':
      return state.map(t => t.id === action.id ? { ...t, paused: true }  : t);
    case 'RESUME':
      return state.map(t => t.id === action.id ? { ...t, paused: false } : t);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const ShieldBlockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
  </svg>
);

const TOAST_META: Record<ToastType, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  success: { icon: <CheckIcon />,      color: '#34d399', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)' },
  error:   { icon: <ShieldBlockIcon/>, color: '#f87171', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)'  },
  warning: { icon: <AlertIcon />,      color: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
  info:    { icon: <InfoIcon />,       color: '#60a5fa', bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)' },
};

// ── ToastItem ─────────────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
  onPause,
  onResume,
}: {
  toast: ToastEntry;
  onRemove: (id: string) => void;
  onPause:  (id: string) => void;
  onResume: (id: string) => void;
}) {
  const meta = TOAST_META[toast.type];
  const [exiting, setExiting] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginExit = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    // Point 2: store the exit timer so it can be cleared
    exitTimerRef.current = setTimeout(() => onRemove(toast.id), 320);
  }, [exiting, onRemove, toast.id]);

  // Auto-dismiss timer — respects pause (Point 7) and custom duration (Point 5)
  useEffect(() => {
  const duration = toast.duration ?? 4000;
  if (duration === 0 || toast.paused) return;

  autoTimerRef.current = setTimeout(beginExit, duration);
  return () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current); // Tambahkan pengecekan jika mau ekstra aman
  };
}, [toast.paused, toast.duration, beginExit]);

// Bagian useEffect unmount
useEffect(() => () => {
  if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
}, []);

  const handleMouseEnter = () => onPause(toast.id);
  const handleMouseLeave = () => onResume(toast.id);

  return (
    <div
      role="alert"
      aria-live="assertive"   // Point 4
      aria-atomic="true"      // Point 4
      onMouseEnter={handleMouseEnter}  // Point 7
      onMouseLeave={handleMouseLeave}  // Point 7
      onClick={beginExit}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        padding: '13px 15px',
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 12,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
        animation: exiting ? 'toast-out 0.32s ease forwards' : 'toast-in 0.32s ease forwards',
        minWidth: 280,
        maxWidth: 380,
        cursor: 'pointer',
        userSelect: 'none',
        // Point 8: no pointer-events hack — parent handles it cleanly
      }}
    >
      {/* Icon */}
      <span style={{ color: meta.color, flexShrink: 0, marginTop: 1 }}>
        {meta.icon}
      </span>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#f1f5f9',
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.4,
          marginBottom: toast.message || toast.action ? 4 : 0,
        }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{
            fontSize: 12, color: '#94a3b8',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.5,
            marginBottom: toast.action ? 8 : 0,
          }}>
            {toast.message}
          </div>
        )}
        {/* High-impact 2: action button */}
        {toast.action && (
          <button
            onClick={e => {
              e.stopPropagation();
              toast.action!.onClick();
              beginExit();
            }}
            style={{
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}35`,
              borderRadius: 6,
              color: meta.color,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              padding: '3px 10px',
              cursor: 'pointer',
              letterSpacing: '0.2px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${meta.color}28`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${meta.color}18`)}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        aria-label="Dismiss notification"
        onClick={e => { e.stopPropagation(); beginExit(); }}
        style={{
          background: 'none', border: 'none',
          color: '#475569', cursor: 'pointer',
          padding: '2px', flexShrink: 0,
          borderRadius: 4, transition: 'color 0.15s',
          lineHeight: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
      >
        <XIcon />
      </button>
    </div>
  );
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(queueReducer, []);

  const remove = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), []);
  const pause  = useCallback((id: string) => dispatch({ type: 'PAUSE',  id }), []);
  const resume = useCallback((id: string) => dispatch({ type: 'RESUME', id }), []);

  const add = useCallback((opts: ToastOptions): string => {
    // Point 1: crypto.randomUUID() — collision-safe, spec-compliant
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`; // SSR fallback
    dispatch({ type: 'ADD', entry: { ...opts, id, paused: false } });
    return id;
  }, []);

  const ctx: ToastContextValue = {
    toast: add,
    success: (title, message, action) => add({ type: 'success', title, message, action }),
    error:   (title, message, action) => add({ type: 'error',   title, message, action }),
    warning: (title, message, action) => add({ type: 'warning', title, message, action }),
    info:    (title, message, action) => add({ type: 'info',    title, message, action }),
    dismiss: remove,
    dismissAll: () => dispatch({ type: 'CLEAR' }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Point 8: clean container — no pointer-events hack */}
      <div
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          // High-impact 3: newest on top, stacked visually
          alignItems: 'flex-end',
        }}
      >
        {toasts.map((t, i) => (
          <div
            key={t.id}
            style={{
              // High-impact 3: stacking — older toasts scale down slightly
              transform: `scale(${1 - (toasts.length - 1 - i) * 0.02})`,
              transformOrigin: 'bottom right',
              transition: 'transform 0.25s ease',
              opacity: 1 - (toasts.length - 1 - i) * 0.08,
            }}
          >
            <ToastItem
              toast={t}
              onRemove={remove}
              onPause={pause}
              onResume={resume}
            />
          </div>
        ))}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateX(0)    scale(1);    max-height: 120px; }
          to   { opacity: 0; transform: translateX(24px) scale(0.95); max-height: 0;     }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ── Convenience re-exports for system integration (Point — High-impact 4) ─────
// Import these pre-baked configs anywhere in the app:
//
//   const { toast } = useToast();
//   toast(TOAST_PRESETS.stepUpRequired);
//   toast(TOAST_PRESETS.blocked('payment:write scope denied'));
//   toast(TOAST_PRESETS.approved('Travel Booking Agent'));

export const TOAST_PRESETS = {
  stepUpRequired: {
    type: 'warning' as ToastType,
    title: 'Step-up approval required',
    message: 'Check the Approvals page to continue.',
    duration: 0, // persist until user acts
  },
  approved: (agentLabel: string): ToastOptions => ({
    type: 'success',
    title: 'Request approved',
    message: `${agentLabel} will now continue execution.`,
    duration: 4000,
  }),
  denied: (agentLabel: string): ToastOptions => ({
    type: 'error',
    title: 'Request denied',
    message: `${agentLabel} received a STEPUP_DENIED response.`,
    duration: 5000,
  }),
  blocked: (reason: string): ToastOptions => ({
    type: 'error',
    title: 'Blocked by policy',
    message: reason,
    duration: 6000,
  }),
  expired: (): ToastOptions => ({
    type: 'warning',
    title: 'Approval request expired',
    message: 'The step-up window timed out. Please retry.',
    duration: 5000,
  }),
};