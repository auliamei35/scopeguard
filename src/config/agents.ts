// src/config/agents.ts
// Decoupled from UI — swap with API fetch later

export interface AgentPreset {
  label: string;
  tool: string;
  params: Record<string, unknown>;
}

export interface AgentConfig {
  id: string;
  label: string;
  color: string;
  placeholders: string[];
  presets: AgentPreset[];
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'travel-booking-agent-v1',
    label: 'Travel Booking Agent',
    color: '#3b82f6',
    placeholders: [
      'Book a flight to Tokyo for $500',
      'Search for flights to Bali on April 15',
      'Book a hotel in Singapore for 3 nights',
    ],
    presets: [
      {
        label: 'Book flight $500 (step-up)',
        tool: 'book_flight',
        params: { destination: 'Tokyo', amount: 500, airline: 'Garuda Indonesia', departure: '2026-04-20' },
      },
      {
        label: 'Search flights (read-only)',
        tool: 'search_flights',
        params: { destination: 'Bali', date: '2026-04-15' },
      },
      {
        label: 'Book flight $1500 (blocked)',
        tool: 'book_flight',
        params: { destination: 'New York', amount: 1500 },
      },
    ],
  },
  {
    id: 'fraud-detection-agent-v1',
    label: 'Fraud Detection Agent',
    color: '#ef4444',
    placeholders: [
      'Check this $200 transaction for fraud',
      'Flag the suspicious $2000 payment',
      'Analyze pattern in recent transfers',
    ],
    presets: [
      {
        label: 'Check transaction $200 (clean)',
        tool: 'check_transaction',
        params: { amount: 200, url: 'https://api.bri.co.id/v1/check' },
      },
      {
        label: 'Flag $2000 transaction (step-up)',
        tool: 'flag_transaction',
        params: { amount: 2000, url: 'https://api.bri.co.id/v1/flag', severity: 'high' },
      },
      {
        label: 'Check $10K (hard block)',
        tool: 'check_transaction',
        params: { amount: 10000, url: 'https://api.bri.co.id/v1/check' },
      },
    ],
  },
  {
    id: 'aml-compliance-agent-v1',
    label: 'AML Compliance Agent',
    color: '#f59e0b',
    placeholders: [
      'Screen this $15,000 transaction for AML',
      'Verify KYC for customer CUST-123',
      'File SAR for suspicious offshore transfer',
    ],
    presets: [
      {
        label: 'AML check domestic $500 (clean)',
        tool: 'check_aml',
        params: { amount: 500, country: 'ID', url: 'https://api.bri.co.id/v1/aml/check' },
      },
      {
        label: 'Screen $50K to Cayman (step-up)',
        tool: 'screen_transaction',
        params: { amount: 50000, country: 'KY', url: 'https://api.bri.co.id/v1/aml/screen' },
      },
      {
        label: 'Check North Korea (OFAC block)',
        tool: 'check_aml',
        params: { amount: 100, country: 'KP', url: 'https://api.bri.co.id/v1/aml/check' },
      },
    ],
  },
  {
    id: 'hr-onboarding-agent-v1',
    label: 'HR Onboarding Agent',
    color: '#10b981',
    placeholders: [
      'Start onboarding for new employee John Doe',
      'Get contact info for employee EMP-001',
      'Provision system access for new hire',
    ],
    presets: [
      {
        label: 'Create onboarding task (clean)',
        tool: 'create_onboarding_task',
        params: { employeeId: 'EMP-001', fields: ['email', 'department', 'name'], url: 'https://api.hr.internal/v1/onboarding' },
      },
      {
        label: 'Get documents (step-up)',
        tool: 'get_employee_documents',
        params: { employeeId: 'EMP-001', fields: ['id_card', 'contract'], url: 'https://api.hr.internal/v1/documents' },
      },
      {
        label: 'Access salary (data block)',
        tool: 'get_payroll',
        params: { employeeId: 'EMP-001', fields: ['salary', 'bonus'], url: 'https://api.hr.internal/v1/payroll' },
      },
    ],
  },
];