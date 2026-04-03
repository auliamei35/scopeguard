# ScopeGuard Agent Registry

Complete documentation for all registered agents. Each agent has its own Auth0 M2M identity, hard constraints enforced at Layer 2, and a specific use case domain.

---

## Agent Overview

| Agent ID | Domain | Max Amount | Step-Up Threshold | Unique Constraint |
|----------|--------|-----------|-------------------|-------------------|
| `travel-booking-agent-v1` | Travel & hospitality | $1,000 | $200 | — |
| `fraud-detection-agent-v1` | Financial security | $5,000 | $1,000 | Velocity: 3/min |
| `aml-compliance-agent-v1` | Regulated compliance | $100,000 | $50,000 | Country block + SAR |
| `hr-onboarding-agent-v1` | Enterprise HR | $0 | $0 | Data classification |

---

## Agent 1: Travel Booking Agent

### Identity

```
Agent ID:   travel-booking-agent-v1
Type:       specialist
Version:    1.0.0
M2M App:    ScopeGuard Agent: travel-booking-agent-v1
Env Keys:   AGENT_TRAVEL_CLIENT_ID, AGENT_TRAVEL_CLIENT_SECRET
```

### Auth0 Application Metadata

```
scopeguard_agent_id:           travel-booking-agent-v1
scopeguard_agent_type:         specialist
scopeguard_max_amount_usd:     1000
scopeguard_allowed_domains:    api.traveloka.com,api.tiket.com
scopeguard_stepup_threshold_usd: 200
```

### Declared Capabilities

```
payment:write          Make payments on behalf of user
calendar:events:write  Create and edit calendar events
email:send             Send emails on behalf of user
```

### Hard Limits (Layer 2)

| Constraint | Value | Behavior |
|-----------|-------|----------|
| Amount ceiling | $1,000 | Hard block — 403 |
| Step-up threshold | $200 | CIBA required before execution |
| Allowed domains | `api.traveloka.com`, `api.tiket.com` | All others hard blocked |
| Max actions/min | 5 | Velocity cap — 403 on exceed |
| Forbidden scopes | `payment:admin`, `contacts:delete`, `files:delete` | Hard block |

### Demo Scenarios

```bash
# Scenario 1: Search flights (read-only, no step-up)
# Expected: success=true, riskLevel=low, minimalScopes=[]
{"toolCall":{"name":"search_flights","params":{"destination":"Bali","date":"2026-04-15"},"requiredConnection":"mock"}}

# Scenario 2: Book flight $500 (step-up required, > $200 threshold)
# Expected: success=true, stepUpCompleted=true, minimalScopes=["payment:write","email:send"]
{"toolCall":{"name":"book_flight","params":{"destination":"Tokyo","amount":500,"airline":"Garuda Indonesia"},"requiredConnection":"mock"}}

# Scenario 3: Book flight $1500 (hard block, > $1000 ceiling)
# Expected: 403 AMOUNT_CEILING
{"toolCall":{"name":"book_flight","params":{"destination":"Tokyo","amount":1500},"requiredConnection":"mock"}}

# Scenario 4: Domain violation
# Expected: 403 DOMAIN_VIOLATION
{"toolCall":{"name":"book_flight","params":{"destination":"Tokyo","amount":100,"url":"https://api.evil.com/book"},"requiredConnection":"mock"}}
```

### LLM Scope Minimization (Layer 3 — Observed)

| Tool Call | Declared (3 scopes) | Actual Used | Reduction |
|-----------|--------------------|-----------:|----------:|
| `search_flights` | payment:write, calendar:events:write, email:send | 0 | 100% |
| `book_flight $500` | payment:write, calendar:events:write, email:send | 2 | 33% |

---

## Agent 2: Fraud Detection Agent

### Identity

```
Agent ID:   fraud-detection-agent-v1
Type:       specialist
Version:    1.0.0
M2M App:    ScopeGuard Agent: fraud-detection-agent-v1
Env Keys:   AGENT_FRAUD_CLIENT_ID, AGENT_FRAUD_CLIENT_SECRET
```

### Auth0 Application Metadata

```
scopeguard_agent_id:           fraud-detection-agent-v1
scopeguard_agent_type:         specialist
scopeguard_max_amount_usd:     5000
scopeguard_allowed_domains:    api.bri.co.id,api.bca.co.id
scopeguard_stepup_threshold_usd: 1000
```

### Declared Capabilities

```
transaction:read    Read transaction data for analysis
transaction:flag    Flag suspicious transactions
alert:write         Submit security alerts
account:read        Read account information (read-only)
```

### Hard Limits (Layer 2)

| Constraint | Value | Behavior |
|-----------|-------|----------|
| Amount ceiling | $5,000 | Hard block — 403 |
| Step-up threshold | $1,000 | CIBA required |
| Allowed domains | `api.bri.co.id`, `api.bca.co.id` | Others hard blocked |
| Max actions/min | **3** | Strict velocity — fraud agents must not batch |
| Forbidden scopes | `transaction:approve`, `account:write`, `account:delete`, `transfer:execute` | Never executable |

### Demo Scenarios

```bash
# Scenario 1: Check small transaction ($200) — pass
# Expected: success=true, riskLevel=low
{"toolCall":{"name":"check_transaction","params":{"amount":200,"url":"https://api.bri.co.id/v1/check"},"requiredConnection":"mock"}}

# Scenario 2: Flag suspicious $2000 transaction — step-up required
# Expected: success=true, stepUpCompleted=true
{"toolCall":{"name":"flag_transaction","params":{"amount":2000,"url":"https://api.bri.co.id/v1/flag","severity":"high"},"requiredConnection":"mock"}}

# Scenario 3: $10,000 transfer — hard block (> $5,000)
# Expected: 403 AMOUNT_CEILING
{"toolCall":{"name":"check_transaction","params":{"amount":10000,"url":"https://api.bri.co.id/v1/check"},"requiredConnection":"mock"}}

# Scenario 4: Domain violation (Mandiri not whitelisted)
# Expected: 403 DOMAIN_VIOLATION
{"toolCall":{"name":"check_transaction","params":{"amount":100,"url":"https://api.mandiri.co.id/v1/check"},"requiredConnection":"mock"}}

# Scenario 5: Velocity cap (run 4 times rapidly)
# Expected: 1-3 pass, 4th = 403 VELOCITY_CAP
{"toolCall":{"name":"check_transaction","params":{"amount":100,"url":"https://api.bri.co.id/v1/check"},"requiredConnection":"mock"}}
```

### Available Tools

```
check_transaction    → api.bri.co.id
flag_transaction     → api.bri.co.id
get_account_history  → api.bca.co.id
submit_alert         → api.bri.co.id
analyze_pattern      → api.bca.co.id
freeze_account       → api.bri.co.id
```

---

## Agent 3: AML Compliance Agent

### Identity

```
Agent ID:   aml-compliance-agent-v1
Type:       specialist
Version:    1.0.0
M2M App:    ScopeGuard Agent: aml-compliance-agent-v1
Env Keys:   AGENT_AML_CLIENT_ID, AGENT_AML_CLIENT_SECRET
```

### Auth0 Application Metadata

```
scopeguard_agent_id:           aml-compliance-agent-v1
scopeguard_agent_type:         specialist
scopeguard_max_amount_usd:     100000
scopeguard_allowed_domains:    akun.bri.co.id,api.bri.co.id
scopeguard_stepup_threshold_usd: 50000
```

### Declared Capabilities

```
transaction:read    Read and analyze transaction records
transaction:flag    Flag suspicious transactions for review
sar:write           File Suspicious Activity Reports (SAR/STR)
kyc:read            Read Know Your Customer (KYC) records
kyc:flag            Flag KYC records for enhanced due diligence
alert:write         Submit compliance alerts
```

### Hard Limits (Layer 2)

| Constraint | Value | Behavior |
|-----------|-------|----------|
| Amount ceiling | $100,000 | Hard block — AML tools handle large transactions |
| Step-up threshold | $50,000 | CIBA required |
| Allowed domains | `akun.bri.co.id`, `api.bri.co.id` | Others hard blocked |
| Max actions/min | 5 | Standard velocity |
| Forbidden scopes | `transaction:approve`, `account:write`, `transfer:execute`, `kyc:delete` | Hard block |

### AML-Specific Constraints (unique to this agent)

| Constraint | Value | Behavior |
|-----------|-------|----------|
| SAR threshold | $10,000 | Triggers step-up — PPATK reporting requirement |
| High-risk countries | `KY`, `VG`, `BZ`, `PA` | Triggers step-up + enhanced audit log |
| Blocked countries (OFAC) | `KP`, `IR`, `SY`, `CU` | **Hard block** — OFAC sanctions compliance |

### Country Classification

```
Hard Blocked (OFAC Sanctioned):
  KP — North Korea
  IR — Iran
  SY — Syria
  CU — Cuba

High-Risk (Step-Up Required):
  KY — Cayman Islands
  VG — British Virgin Islands
  BZ — Belize
  PA — Panama
```

### Demo Scenarios

```bash
# Scenario 1: Domestic AML check ($500, Indonesia) — pass, no step-up
# Expected: success=true, stepUpCompleted=false
{"toolCall":{"name":"check_aml","params":{"amount":500,"country":"ID","url":"https://api.bri.co.id/v1/aml/check"},"requiredConnection":"mock"}}

# Scenario 2: $50K to Cayman Islands — step-up (high-risk country + high amount)
# Expected: success=true, stepUpCompleted=true
{"toolCall":{"name":"screen_transaction","params":{"amount":50000,"country":"KY","url":"https://api.bri.co.id/v1/aml/screen"},"requiredConnection":"mock"}}

# Scenario 3: Transaction to North Korea — HARD BLOCK (OFAC sanctioned)
# Expected: 403 COUNTRY_BLOCKED
{"toolCall":{"name":"check_aml","params":{"amount":100,"country":"KP","url":"https://api.bri.co.id/v1/aml/check"},"requiredConnection":"mock"}}

# Scenario 4: File SAR for $15K transaction — step-up (SAR threshold $10K)
# Expected: success=true, stepUpCompleted=true
{"toolCall":{"name":"file_sar","params":{"amount":15000,"country":"SG","url":"https://akun.bri.co.id/v1/sar/file"},"requiredConnection":"mock"}}

# Scenario 5: KYC verification — pass, no step-up
# Expected: success=true, stepUpCompleted=false
{"toolCall":{"name":"verify_kyc","params":{"customerId":"CUST-123","country":"ID","url":"https://akun.bri.co.id/v1/kyc/verify"},"requiredConnection":"mock"}}

# Scenario 6: Forbidden scope — SCOPE_CEILING
# Expected: 403 SCOPE_CEILING
{"toolCall":{"name":"verify_kyc","params":{"country":"ID","url":"https://akun.bri.co.id/v1/kyc","scopes":["kyc:delete"]},"requiredConnection":"mock"}}
```

### Available Tools

```
check_aml            → api.bri.co.id
file_sar             → akun.bri.co.id  (PPATK STR filing)
verify_kyc           → akun.bri.co.id
flag_kyc             → akun.bri.co.id
screen_transaction   → api.bri.co.id
generate_sar_report  → akun.bri.co.id
```

---

## Agent 4: HR Onboarding Agent

### Identity

```
Agent ID:   hr-onboarding-agent-v1
Type:       specialist
Version:    1.0.0
M2M App:    ScopeGuard Agent: hr-onboarding-agent-v1
Env Keys:   AGENT_HR_CLIENT_ID, AGENT_HR_CLIENT_SECRET
```

### Auth0 Application Metadata

```
scopeguard_agent_id:           hr-onboarding-agent-v1
scopeguard_agent_type:         specialist
scopeguard_max_amount_usd:     0
scopeguard_allowed_domains:    api.hr.internal,api.directory.internal
scopeguard_stepup_threshold_usd: 0
```

### Declared Capabilities

```
employee:read      Read employee records (allowed fields only)
employee:write     Update employee information (restricted)
directory:write    Provision system access
email:send         Send onboarding communications
onboarding:write   Create and manage onboarding workflows
```

### Hard Limits (Layer 2)

| Constraint | Value | Behavior |
|-----------|-------|----------|
| Amount ceiling | $0 | HR agent never handles payments |
| Step-up threshold | $0 | Step-up triggered by data classification only |
| Allowed domains | `api.hr.internal`, `api.directory.internal` | All external domains blocked |
| Max actions/min | 10 | Standard for HR workflows |
| Forbidden scopes | `employee:delete`, `payroll:write`, `payroll:read`, `medical:read`, `medical:write`, `performance:delete` | Never accessible |

### Data Classification (unique to this agent)

**Allowed fields** (freely readable):
```
email, phone, department, name, position,
start_date, manager, team, role
```

**Step-up required fields** (sensitive but accessible with approval):
```
address, id_card, contract, nda
```

**Hard blocked fields** (data classification — never accessible):
```
salary, bonus, tax, bank_account,
salary_history, performance_score, review_notes,
rating, medical_history, insurance, disability
```

**Data retention:** 90 days maximum cache

### Demo Scenarios

```bash
# Scenario 1: Create onboarding task (allowed fields) — pass
# Expected: success=true, riskLevel=low
{"toolCall":{"name":"create_onboarding_task","params":{"employeeId":"EMP-001","fields":["email","department","name"],"url":"https://api.hr.internal/v1/onboarding"},"requiredConnection":"mock"}}

# Scenario 2: Get contact info (allowed fields) — pass
# Expected: success=true
{"toolCall":{"name":"get_employee_contact","params":{"employeeId":"EMP-001","fields":["email","phone"],"url":"https://api.hr.internal/v1/contact"},"requiredConnection":"mock"}}

# Scenario 3: Access salary — DATA_CLASSIFICATION_BLOCKED
# Expected: 403 DATA_CLASSIFICATION_BLOCKED: Fields [salary, bonus]
{"toolCall":{"name":"get_payroll","params":{"employeeId":"EMP-001","fields":["salary","bonus"],"url":"https://api.hr.internal/v1/payroll"},"requiredConnection":"mock"}}

# Scenario 4: Access performance review — DATA_CLASSIFICATION_BLOCKED
# Expected: 403 DATA_CLASSIFICATION_BLOCKED: Fields [performance_score, rating]
{"toolCall":{"name":"get_performance_review","params":{"employeeId":"EMP-001","fields":["performance_score","rating"],"url":"https://api.hr.internal/v1/performance"},"requiredConnection":"mock"}}

# Scenario 5: Access employee documents (id_card) — step-up required
# Expected: success=true, stepUpCompleted=true
{"toolCall":{"name":"get_employee_documents","params":{"employeeId":"EMP-001","fields":["id_card","contract"],"url":"https://api.hr.internal/v1/documents"},"requiredConnection":"mock"}}

# Scenario 6: Forbidden scope — SCOPE_CEILING
# Expected: 403 SCOPE_CEILING
{"toolCall":{"name":"get_employee_profile","params":{"employeeId":"EMP-001","fields":["email"],"url":"https://api.hr.internal/v1/employees","scopes":["employee:delete"]},"requiredConnection":"mock"}}

# Scenario 7: External domain — DOMAIN_VIOLATION
# Expected: 403 DOMAIN_VIOLATION
{"toolCall":{"name":"get_employee_profile","params":{"employeeId":"EMP-001","fields":["email"],"url":"https://api.external-hr.com/v1/employees"},"requiredConnection":"mock"}}
```

### Available Tools

```
get_employee_profile    → api.hr.internal
get_employee_contact    → api.hr.internal
create_onboarding_task  → api.hr.internal
update_department       → api.hr.internal
get_payroll             → api.hr.internal  (blocked by data classification)
get_performance_review  → api.hr.internal  (blocked by data classification)
get_medical_records     → api.hr.internal  (blocked by data classification)
provision_access        → api.directory.internal
send_welcome_email      → api.hr.internal
get_employee_documents  → api.hr.internal  (step-up required)
```

---

## Adding a New Agent

### Step 1: Create Auth0 M2M Application

In Auth0 Dashboard → Applications → + Create Application:
- Type: Machine to Machine
- Authorize against: ScopeGuard API
- Grant type: Client Credentials
- Add Application Metadata (minimum required fields):

```
scopeguard_agent_id:             your-agent-id
scopeguard_agent_type:           specialist | orchestrator | tool-executor
scopeguard_max_amount_usd:       numeric string
scopeguard_allowed_domains:      comma-separated domain list
scopeguard_stepup_threshold_usd: numeric string
```

### Step 2: Add to `.env.local`

```bash
AGENT_YOUR_CLIENT_ID=
AGENT_YOUR_CLIENT_SECRET=
```

### Step 3: Add to Registry

```typescript
// src/lib/agent-registry.ts
const yourAgent: AgentProfile = {
  agentId: 'your-agent-id',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: ['scope:one', 'scope:two'],
  hardLimits: {
    maxTransactionAmountUSD: 500,
    allowedDomains: ['api.yourservice.com'],
    maxActionsPerMinute: 10,
    forbiddenScopes: ['admin:write'],
    requiresStepUpAboveUSD: 100,
    // AML-specific (optional):
    // highRiskCountries: ['KY', 'VG'],
    // sarThresholdUSD: 10000,
    // blockedCountries: ['KP'],
    // HR-specific (optional):
    // allowedDataFields: ['email', 'name'],
    // blockedDataFields: ['salary', 'medical'],
    // requiresStepUpForFields: ['id_card'],
  },
  auth0ClientId: '',
  createdAt: new Date(),
  version: '1.0.0',
  isActive: true,
};
```

### Step 4: Update `resolveClientId`

```typescript
const clientIdMap: Record<string, string> = {
  // ... existing agents ...
  'your-agent-id': process.env.AGENT_YOUR_CLIENT_ID || '',
};
```

### Step 5: Add Domain Mapping

In `src/lib/extract-params.ts`, add your tool-to-domain mappings:

```typescript
your_tool_name: 'api.yourservice.com',
```

### Step 6: Add Mock Results (Optional)

In `src/lib/token-vault.ts`, add realistic mock results for your tools.

### Step 7: Create Demo Script

Copy `src/demo/travel-agent.ts` as a template and customize scenarios.

---

## Constraint Violation Reference

| Violation Code | Layer | Trigger Condition |
|---------------|-------|------------------|
| `AMOUNT_CEILING` | L2 | `amount > maxTransactionAmountUSD` |
| `DOMAIN_VIOLATION` | L2 | `domain not in allowedDomains` |
| `VELOCITY_CAP` | L2 | `actionsInLast60s >= maxActionsPerMinute` |
| `SCOPE_CEILING` | L2 | `requestedScope in forbiddenScopes` |
| `COUNTRY_BLOCKED` | L2 | `country in blockedCountries` (OFAC) |
| `DATA_CLASSIFICATION_BLOCKED` | L2 | `requestedField in blockedDataFields` |

| Step-Up Trigger | Condition |
|----------------|-----------|
| Amount threshold | `amount > requiresStepUpAboveUSD` |
| SAR threshold | `amount >= sarThresholdUSD` |
| High-risk country | `country in highRiskCountries` |
| Sensitive data field | `field in requiresStepUpForFields` |
| Irreversible action | tool name matches irreversible patterns + amount > 0 |

