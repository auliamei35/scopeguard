// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AuditLogEntry } from '@/types';

interface Stats {
  total: number;
  blocked: number;
  stepUps: number;
  success: number;
  blockRate: number;
  avgScopeReduction: number;
}

interface AuditResponse {
  logs: AuditLogEntry[];
  stats: Stats;
}

type NavItem = {
  id: string;
  label: string;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'agents', label: 'Agents' },
  { id: 'activity', label: 'Activity Logs', badge: 3 },
  { id: 'rules', label: 'Security Rules' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' },
];

const MONTH_DATA = [
  { month: 'Mar', value: 42 },
  { month: 'Apr', value: 67 },
  { month: 'May', value: 38 },
  { month: 'Jun', value: 91 },
  { month: 'Jul', value: 55 },
  { month: 'Aug', value: 73 },
  { month: 'Sep', value: 48 },
  { month: 'Oct', value: 82 },
  { month: 'Nov', value: 61 },
];

function humanizeEvent(log: AuditLogEntry): {
  label: string;
  labelColor: string;
  labelBg: string;
  title: string;
  detail: string;
  timeAgo: string;
  borderColor: string;
} {
  const now = Date.now();
  const diff = now - new Date(log.timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const timeAgo =
    mins === 0 ? 'Just now' :
    mins === 1 ? '1 minute ago' :
    mins < 60 ? `${mins} minutes ago` :
    `${Math.floor(mins / 60)}h ago`;

  const tool = log.toolName
    ? log.toolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Unknown Action';

  switch (log.event) {
    case 'CONSTRAINT_BLOCKED':
      return {
        label: 'Blocked',
        labelColor: '#ef4444',
        labelBg: 'rgba(239,68,68,0.1)',
        title: tool,
        detail: log.constraintViolations?.[0]?.includes('AMOUNT')
          ? 'The transaction amount exceeded the maximum limit allowed for this agent.'
          : log.constraintViolations?.[0]?.includes('DOMAIN')
          ? 'The request was directed to an untrusted external source that is not permitted by security policy.'
          : log.constraintViolations?.[0]?.includes('VELOCITY')
          ? 'Too many requests were made in a short period. Rate limit enforced.'
          : 'This action was blocked by the security policy.',
        timeAgo,
        borderColor: '#ef4444',
      };
    case 'IDENTITY_REJECTED':
      return {
        label: 'Auth Failed',
        labelColor: '#f97316',
        labelBg: 'rgba(249,115,22,0.1)',
        title: 'Identity Verification Failed',
        detail: 'An unrecognized agent attempted to access the gateway and was rejected.',
        timeAgo,
        borderColor: '#f97316',
      };
    case 'AGENT_IDENTITY_RESOLVED':
      return {
        label: 'Verified',
        labelColor: '#3b82f6',
        labelBg: 'rgba(59,130,246,0.1)',
        title: 'Agent Authenticated',
        detail: `${log.agentId} was recognized and granted access to proceed.`,
        timeAgo,
        borderColor: '#3b82f6',
      };
    case 'STEPUP_TRIGGERED':
      return {
        label: 'Approval Needed',
        labelColor: '#f59e0b',
        labelBg: 'rgba(245,158,11,0.1)',
        title: `High-Value Action — ${tool}`,
        detail: 'This action requires manual user approval before it can proceed.',
        timeAgo,
        borderColor: '#f59e0b',
      };
    case 'STEPUP_APPROVED':
      return {
        label: 'Approved',
        labelColor: '#10b981',
        labelBg: 'rgba(16,185,129,0.1)',
        title: 'User Approved Request',
        detail: 'The user reviewed and approved the high-value action.',
        timeAgo,
        borderColor: '#10b981',
      };
    case 'STEPUP_DENIED':
      return {
        label: 'Denied',
        labelColor: '#ef4444',
        labelBg: 'rgba(239,68,68,0.1)',
        title: 'User Rejected Request',
        detail: 'The user reviewed and explicitly denied this action.',
        timeAgo,
        borderColor: '#ef4444',
      };
    case 'TOOL_EXECUTED_SUCCESS':
      return {
        label: 'Completed',
        labelColor: '#10b981',
        labelBg: 'rgba(16,185,129,0.1)',
        title: tool,
        detail: log.scopesActuallyUsed?.length
          ? `Completed successfully. Permissions used: ${log.scopesActuallyUsed.map(s => s.replace(/:/, ' — ').replace(/_/g, ' ')).join(', ')}.`
          : 'Action completed successfully with minimal permissions.',
        timeAgo,
        borderColor: '#10b981',
      };
    case 'SCOPE_DECIDED':
      return {
        label: 'Analyzed',
        labelColor: '#8b5cf6',
        labelBg: 'rgba(139,92,246,0.1)',
        title: `Permission Analysis — ${tool}`,
        detail: `Minimal permissions calculated. Risk level: ${log.riskLevel || 'assessed'}.`,
        timeAgo,
        borderColor: '#8b5cf6',
      };
    default:
      return {
        label: log.event.replace(/_/g, ' '),
        labelColor: '#64748b',
        labelBg: 'rgba(100,116,139,0.1)',
        title: tool,
        detail: log.errorMessage || 'Event recorded.',
        timeAgo,
        borderColor: '#64748b',
      };
  }
}

// ── Icons (SVG outline, no emoji) ────────────────────────────────
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconActivity = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
);
const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconPulse = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const NAV_ICONS = [IconGrid, IconUsers, IconActivity, IconLock, IconSettings, IconHelp];

export default function DashboardPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRunning, setDemoRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [pulse, setPulse] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/audit');
      const json = await res.json();
      setData(json);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  const runDemo = async () => {
    setDemoRunning(true);
    setAutoRefresh(true);
    await fetch('/api/demo', { method: 'POST' });
    setTimeout(() => {
      setAutoRefresh(false);
      setDemoRunning(false);
    }, 35000);
  };

  const stats = data?.stats;
  const logs = data?.logs || [];
  const maxMonthVal = Math.max(...MONTH_DATA.map(d => d.value));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #0a0e1a;
          --surface:  #111827;
          --surface2: #1a2235;
          --surface3: #1e2d45;
          --border:   rgba(255,255,255,0.06);
          --border2:  rgba(255,255,255,0.12);
          --blue:     #2563eb;
          --blue-l:   #3b82f6;
          --blue-xl:  #60a5fa;
          --green:    #10b981;
          --red:      #ef4444;
          --orange:   #f59e0b;
          --purple:   #8b5cf6;
          --text:     #f1f5f9;
          --text-2:   #94a3b8;
          --text-3:   #475569;
          --font:     'DM Sans', sans-serif;
          --mono:     'JetBrains Mono', monospace;
          --r:        12px;
          --r-lg:     16px;
        }

        body { background: var(--bg); font-family: var(--font); color: var(--text); }

        .layout { 
          display: flex; 
          min-height: 100vh; 
          align-items: flex-start;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 24px 0;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px 28px;
          border-bottom: 1px solid var(--border);
        }
        .logo-icon {
          width: 32px; height: 32px;
          background: var(--blue);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .logo-text { font-size: 15px; font-weight: 600; letter-spacing: -0.3px; }
        .logo-sub { font-size: 11px; color: var(--text-3); margin-top: 1px; font-family: var(--mono); }

        .nav { margin-top: 16px; flex: 1; }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 400;
          color: var(--text-2);
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
          border-radius: 0;
          margin: 1px 8px;
          border-radius: 8px;
        }
        .nav-item:hover { background: var(--surface2); color: var(--text); }
        .nav-item.active {
          background: rgba(37,99,235,0.15);
          color: var(--blue-xl);
          font-weight: 500;
        }
        .nav-item.active::before {
          content: '';
          position: absolute;
          left: -8px;
          top: 50%; transform: translateY(-50%);
          width: 3px; height: 20px;
          background: var(--blue);
          border-radius: 0 2px 2px 0;
        }
        .nav-badge {
          margin-left: auto;
          background: var(--red);
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 20px;
          min-width: 18px;
          text-align: center;
          font-family: var(--mono);
        }

        .sidebar-footer {
          padding: 16px 20px 0;
          border-top: 1px solid var(--border);
        }
        .agent-pill {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: var(--surface2);
          border-radius: 10px;
          border: 1px solid var(--border);
        }
        .agent-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 6px var(--green);
          flex-shrink: 0;
        }
        .agent-name { font-size: 12px; font-weight: 500; color: var(--text); }
        .agent-status { font-size: 11px; color: var(--text-2); margin-top: 1px; }

        /* ── Main ── */
        .main { 
          flex: 1; 
          padding: 28px 32px; 
          min-width: 0;
        }

        /* Header */
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
        }
        .header-title { font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
        .header-sub { font-size: 13px; color: var(--text-2); margin-top: 4px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }

        .btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          font-family: var(--font);
        }
        .btn-ghost {
          background: var(--surface);
          color: var(--text-2);
          border: 1px solid var(--border2);
        }
        .btn-ghost:hover { background: var(--surface2); color: var(--text); }
        .btn-primary {
          background: var(--blue);
          color: white;
        }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .live-badge {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 500;
          color: var(--green);
          font-family: var(--mono);
          padding: 6px 10px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 6px;
        }
        .live-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--green);
          animation: livePulse 1.5s infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(16,185,129,0); }
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: 16px;
          transition: border-color 0.2s;
        }
        .stat-card:hover { border-color: var(--border2); }
        .stat-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 600;
          letter-spacing: -1px;
          font-family: var(--mono);
          line-height: 1;
        }

        /* Insight bar */
        .insight-bar {
          background: linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(59,130,246,0.06) 100%);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--r);
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .insight-icon {
          width: 28px; height: 28px;
          background: rgba(59,130,246,0.15);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: var(--blue-xl);
          flex-shrink: 0;
        }
        .insight-text {
          font-size: 13px;
          color: #93c5fd;
          line-height: 1.5;
        }
        .insight-text strong { color: #bfdbfe; font-weight: 600; }

        /* Two column layout */
        .two-col {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 20px;
          align-items: start;
        }

        /* Activity feed */
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .panel-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .panel-title {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.2px;
        }
        .panel-sub {
          font-size: 12px;
          color: var(--text-3);
          margin-top: 2px;
        }

        .activity-feed { 
          overflow: visible; 
          height: auto;
        }
        .activity-feed::-webkit-scrollbar { width: 6px; }
        .activity-feed::-webkit-scrollbar-track { background: transparent; }
        .activity-feed::-webkit-scrollbar-thumb { 
          background: var(--border2); 
          border-radius: 10px; 
        }

        .activity-item {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
          border-left: 3px solid transparent;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .activity-item:hover { background: rgba(255,255,255,0.02); }
        .activity-item:last-child { border-bottom: none; }

        .activity-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .activity-label {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-family: var(--mono);
        }
        .activity-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          flex: 1;
        }
        .activity-time {
          font-size: 11px;
          color: var(--text-3);
          font-family: var(--mono);
          flex-shrink: 0;
        }
        .activity-detail {
          font-size: 12px;
          color: var(--text-2);
          line-height: 1.55;
          padding-left: 2px;
        }
        .activity-agent {
          font-size: 11px;
          color: var(--text-3);
          margin-top: 4px;
          font-family: var(--mono);
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
          color: var(--text-3);
        }
        .empty-state p { font-size: 13px; margin-top: 8px; }

        /* Right panel */
        .right-col { 
          display: flex; 
          flex-direction: column; 
          gap: 16px;
          position: sticky;
          top: 28px; 
        }

        /* Chart */
        .chart-area { padding: 20px; }
        .chart-meta { margin-bottom: 16px; }
        .chart-total { font-size: 28px; font-weight: 600; font-family: var(--mono); letter-spacing: -1px; }
        .chart-period { font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 100px;
        }
        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          height: 100%;
          justify-content: flex-end;
        }
        .bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          background: var(--surface3);
          transition: background 0.2s, transform 0.2s;
          cursor: pointer;
          min-height: 4px;
        }
        .bar:hover { background: var(--blue-l); transform: scaleY(1.03); }
        .bar.active-bar { background: var(--blue); }
        .bar-label {
          font-size: 10px;
          color: var(--text-3);
          font-family: var(--mono);
          margin-top: 4px;
        }

        /* Info card */
        .info-card {
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%);
          border-radius: var(--r-lg);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .info-card::before {
          content: '';
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
        }
        .info-card::after {
          content: '';
          position: absolute;
          bottom: -20px; right: 20px;
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
        }
        .info-badge {
          display: inline-block;
          background: rgba(255,255,255,0.15);
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 12px;
          font-family: var(--mono);
        }
        .info-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
          line-height: 1.4;
          margin-bottom: 10px;
        }
        .info-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          line-height: 1.6;
          margin-bottom: 18px;
        }
        .info-btn {
          background: white;
          color: #1e40af;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font);
          transition: opacity 0.15s;
          width: fit-content;
        }
        .info-btn:hover { opacity: 0.9; }

        /* Security score */
        .score-panel { padding: 20px; }
        .score-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .score-label { font-size: 12px; color: var(--text-2); }
        .score-val { font-size: 12px; font-weight: 600; font-family: var(--mono); }
        .score-bar-track {
          height: 4px;
          background: var(--surface2);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 14px;
        }
        .score-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 1s ease;
        }
      `}</style>

      <div className="layout">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon"><IconShield /></div>
            <div>
              <div className="logo-text">ScopeGuard</div>
              <div className="logo-sub">v2.0</div>
            </div>
          </div>

          <nav className="nav">
            {NAV_ITEMS.map((item, i) => {
              const Icon = NAV_ICONS[i];
              return (
                <div
                  key={item.id}
                  className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
                  onClick={() => {
                    // Logika baru dimulai di sini
                    const routes: Record<string, string> = {
                      agents:   '/consent',
                      activity: '/activity',
                      rules:    '/rules',
                      settings: '/settings',
                      help:     '/help',
                    };
                    if (routes[item.id]) {
                      window.location.href = routes[item.id];
                    } else {
                      setActiveNav(item.id);
                    }
                  }}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="agent-pill">
              <div className="agent-dot" />
              <div>
                <div className="agent-name">Travel Agent</div>
                <div className="agent-status">Active · v1.0.0</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">

          {/* Header */}
          <div className="header">
            <div>
              <h1 className="header-title">ScopeGuard Dashboard</h1>
              <p className="header-sub">Real-time agent authorization monitoring</p>
            </div>
            <div className="header-actions">
              {autoRefresh && (
                <div className="live-badge">
                  <div className="live-dot" />
                  Live
                </div>
              )}
              <button className="btn btn-ghost" onClick={fetchData}>
                <IconRefresh />
                Refresh
              </button>
              <button className="btn btn-primary" onClick={runDemo} disabled={demoRunning}>
                <IconPlay />
                {demoRunning ? 'Demo running...' : 'Run Demo'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { label: 'Total Requests', value: stats?.total ?? 0, color: 'var(--text)' },
              { label: 'Successful', value: stats?.success ?? 0, color: 'var(--green)' },
              { label: 'Blocked', value: stats?.blocked ?? 0, color: 'var(--red)' },
              { label: 'Step-up Approvals', value: stats?.stepUps ?? 0, color: 'var(--orange)' },
              { label: 'Block Rate', value: `${stats?.blockRate ?? 0}%`, color: 'var(--red)' },
              { label: 'Scope Reduction', value: `${stats?.avgScopeReduction ?? 0}%`, color: 'var(--blue-xl)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Insight bar */}
          {stats && stats.avgScopeReduction > 0 && (
            <div className="insight-bar">
              <div className="insight-icon"><IconInfo /></div>
              <p className="insight-text">
                ScopeGuard reduced token permissions by{' '}
                <strong>{stats.avgScopeReduction}% on average</strong>
                {' '}— agents only received the permissions they actually needed,
                not everything they declared upfront.
              </p>
            </div>
          )}

          {/* Two column */}
          <div className="two-col">

            {/* Left: Activity Feed */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Live Activity Monitoring</div>
                  <div className="panel-sub">
                    {logs.length} event{logs.length !== 1 ? 's' : ''} recorded
                  </div>
                </div>
                {autoRefresh && (
                  <div className="live-badge">
                    <div className="live-dot" />
                    Updating
                  </div>
                )}
              </div>

              <div className="activity-feed">
                {loading ? (
                  <div className="empty-state">
                    <IconPulse />
                    <p>Loading activity...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="empty-state">
                    <IconShield />
                    <p>No activity yet — click Run Demo to see ScopeGuard in action</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const h = humanizeEvent(log);
                    return (
                      <div
                        key={log.id}
                        className="activity-item"
                        style={{ borderLeftColor: h.borderColor }}
                      >
                        <div className="activity-top">
                          <span
                            className="activity-label"
                            style={{ color: h.labelColor, background: h.labelBg }}
                          >
                            {h.label}
                          </span>
                          <span className="activity-title">{h.title}</span>
                          <span className="activity-time">{h.timeAgo}</span>
                        </div>
                        <div className="activity-detail">{h.detail}</div>
                        <div className="activity-agent">Agent: {log.agentId}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="right-col">

              {/* Chart */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Monthly Activity</div>
                    <div className="panel-sub">Requests processed</div>
                  </div>
                </div>
                <div className="chart-area">
                  <div className="chart-meta">
                    <div className="chart-total">{MONTH_DATA.reduce((a, b) => a + b.value, 0)}</div>
                    <div className="chart-period">Total this period</div>
                  </div>
                  <div className="bar-chart">
                    {MONTH_DATA.map(({ month, value }) => (
                      <div key={month} className="bar-col">
                        <div
                          className={`bar ${month === 'Jun' ? 'active-bar' : ''}`}
                          style={{ height: `${(value / maxMonthVal) * 100}%` }}
                          title={`${month}: ${value}`}
                        />
                        <div className="bar-label">{month}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Security score */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Security Health</div>
                    <div className="panel-sub">Current protection status</div>
                  </div>
                </div>
                <div className="score-panel">
                  {[
                    { label: 'Identity Enforcement', val: 100, color: 'var(--green)' },
                    { label: 'Hard Constraints', val: 100, color: 'var(--green)' },
                    { label: 'Scope Minimization', val: stats?.avgScopeReduction ?? 67, color: 'var(--blue-xl)' },
                    { label: 'Step-up Coverage', val: stats && stats.stepUps > 0 ? 100 : 80, color: 'var(--orange)' },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div className="score-row">
                        <span className="score-label">{label}</span>
                        <span className="score-val" style={{ color }}>{val}%</span>
                      </div>
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{ width: `${val}%`, background: color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info card */}
              <div className="info-card">
                <div className="info-badge">Security Update</div>
                <div className="info-title">
                  ScopeGuard now automatically blocks suspicious external API requests
                </div>
                <div className="info-desc">
                  Domain whitelisting is enforced at the gateway level — no agent can call unauthorized endpoints, even under prompt injection.
                </div>
                <button className="info-btn">
                  Learn More <IconChevronRight />
                </button>
              </div>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}