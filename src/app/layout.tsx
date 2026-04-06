// src/app/layout.tsx — Root layout with ToastProvider
import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'ScopeGuard — Dynamic Permission Negotiator for AI Agents',
  description:
    'LLM-driven authorization gateway for AI agents. Four-layer defense: Agent Identity, Hard Constraints, Gemini scope minimization, and Post-Execution Verification.',
  keywords: ['AI agents', 'Auth0', 'Token Vault', 'CIBA', 'authorization', 'security'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}