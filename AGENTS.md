# ScopeGuard Agent Registry

Complete documentation for all registered agents. Each agent has its own Auth0 M2M identity, hard constraints enforced at Layer 2, and a specific use case domain.

---

## Agent Overview

| Agent ID | Domain | Max Amount | Step-Up Threshold | Unique Constraint |
|----------|--------|-----------|-------------------|-------------------|
| `travel-booking-agent-v1` | Travel & hospitality | $1,000 | $200 | — |
| `fraud-detection-agent-v1` | Financial security | $5,000 | $1,000 | Velocity: 3/min |
| `aml-compliance-agent-v1` | Regulated compliance | $100,000 | $50,000 | Country block + SAR |
| `hr-onboarding-agent-v1` | Enterprise HR | $0 | $0 | Data classification | Field leak + PII |

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
| Forbidden scopes | `payment:admin`, `contacts:delete`, `files:delete` | 403 SCOPE_CEILING |

### Layer 4 Post-Execution Verification

| Check | Configuration |
|-------|--------------|
| Amount drift | Flags if response amount differs >5% from request |
| Scope overshoot | Flags write indicators if only read scopes authorized |
| Anomalous volume | `book_flight`: 2KB, `search_flights`: 10KB threshold |
| PII scan | Applied only to `search_flights` (strict non-PII tool) |

### Layer 3 Scope Minimization (Observed)

| Tool Call | Declared (3 scopes) | Gemini Selected | Reduction |
|-----------|--------------------|-----------------|---------:|
| `search_flights` | payment:write, calendar:events:write, email:send | **0** | 100% |
| `book_flight $500` | payment:write, calendar:events:write, email:send | 2 | 33% |

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

### Layer 4 Post-Execution Verification

| Check | Configuration |
|-------|--------------|
| Amount drift | Flags >5% discrepancy between requested and response amount |
| Scope overshoot | Flags if write indicators appear in read-only responses |
| Anomalous volume | `check_transaction`: 5KB threshold |
| PII scan | **Not applied** — fraud tools legitimately reference transaction IDs (allowlisted) |

**Why PII scan is not applied to `check_transaction`:** The mock result contains fields like `transactionId: "TXN-1775227554920"` — 16-digit numbers that could false-positive against naive credit card regex. The multi-layer PII engine handles this correctly:
- Layer A (Allowlist): `TXN-` prefix → skipped
- Even if not allowlisted: Layer B (Context) → 13-digit timestamp check
- Even if not timestamp: Layer C (Luhn) → `1775227554920` fails Luhn → not flagged

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

| Type | Value | Behavior |
|------|-------|----------|
| SAR threshold | $10,000 | Step-up triggered — PPATK reporting |
| High-risk countries | `KY`, `VG`, `BZ`, `PA` | Step-up triggered + enhanced audit |
| Blocked countries (OFAC) | `KP`, `IR`, `SY`, `CU` | **Hard block** — 403 COUNTRY_BLOCKED |

**Why `maxTransactionAmountUSD` is $100,000 for AML:** AML tools must analyze large transactions to fulfill their compliance purpose. The $10,000 SAR threshold triggers step-up without hard-blocking — compliance officers need to file reports on high-value transactions, not reject them outright.

### Layer 4 Post-Execution Verification

| Check | Configuration |
|-------|--------------|
| Amount drift | Flags >5% discrepancy |
| Scope overshoot | Write indicators in read-only responses |
| Anomalous volume | `check_aml`: 8KB, `file_sar`: 5KB, `verify_kyc`: 4KB |
| PII scan | Applied to `generate_sar_report` (strict non-PII tool) |

### Country Classification

```
Hard Blocked (OFAC Sanctioned — 403 COUNTRY_BLOCKED):
  KP — North Korea
  IR — Iran
  SY — Syria
  CU — Cuba

High-Risk Jurisdictions (Step-Up Required):
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

| Constraint | Value | On Violation |
|-----------|-------|-------------|
| Amount ceiling | $0 | N/A — HR agent never handles payments |
| Step-up threshold | $0 | Triggered only by data classification |
| Allowed domains | `api.hr.internal`, `api.directory.internal` | 403 DOMAIN_VIOLATION |
| Max actions/min | 10 | 403 VELOCITY_CAP |
| Forbidden scopes | `employee:delete`, `payroll:write`, `payroll:read`, `medical:read`, `medical:write`, `performance:delete` | 403 SCOPE_CEILING |

### Data Classification (HR-specific L2 constraint)

**Allowed fields** — readable without step-up:
```
email, phone, department, name, position,
start_date, manager, team, role
```

**Step-up required fields** — sensitive, readable only with CIBA approval:
```
address, id_card, contract, nda
```

**Hard blocked fields** — 403 DATA_CLASSIFICATION_BLOCKED:
```
salary, bonus, tax, bank_account, salary_history,
performance_score, review_notes, rating,
medical_history, insurance, disability
```

**Data retention:** 90 days maximum

### Layer 4 Post-Execution Verification

| Check | Configuration |
|-------|--------------|
| Sensitive field leak | Scans response for ALL blocked data fields (salary, medical, performance, etc.) |
| Generic field patterns | npwp, private_key, client_secret in any response |
| Multi-layer PII | Full scan applied — NIK (Indonesian ID) and credit card with Luhn validation |
| Amount drift | N/A — HR agent has no payment amounts |
| Anomalous volume | `get_employee_profile`: 3KB threshold |

**Why Layer 4 is especially important for HR:** Layer 2 blocks *requests* for blocked fields. But what if a backend misconfiguration includes salary data in a general employee profile response? Layer 4 catches this at output — the data never reaches the agent.


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

---

## Layer 4: Multi-Layer PII Detection (Applies to All Agents)

The same PII engine runs after every tool execution. It uses four sequential validation layers:

```
Input: Any string value in the response JSON

Layer A — Allowlist: Is this value obviously safe?
  • Has system prefix? (TXN-, BK-, CASE-, ALERT-, AML-, EMP-...) → SKIP
  • Is field name in safe set? (transactionId, riskScore, confidence...) → SKIP
  • Matches UUID format? → SKIP
  ↓ only if not allowlisted

Layer B — Context / Sanity Check: Could this be a system number?
  • 13-digit number that converts to year 2020-2035? → Unix timestamp → SKIP
  • 10-digit number in Unix timestamp seconds range? → SKIP
  ↓ only if passes context check

Layer C — Algorithm Validation: Is this mathematically valid PII?
  • Run Luhn algorithm → PASS → Credit card confirmed (high confidence)
  • Check NIK structure:
      - Province code valid (11-96)?
      - Day valid (01-71, +40 for women)?
      - Month valid (01-12)?
      - Not a timestamp?
    → PASS → NIK confirmed (high confidence)
  ↓ only high-confidence candidates trigger violations

Action on confirmed PII:
  → severity: critical → quarantine result
  → masked value logged: "4532****3366" or "350601**********"
```

**Key design principle:** Regex alone creates false positives (e.g., timestamp `1775227554920` matches 13-digit pattern). The context check and Luhn algorithm eliminate these. Only mathematically valid PII triggers a violation.

---

## Constraint Violation Reference

### Layer 2 Violations (pre-execution, always block or step-up)

| Code | Trigger |
|------|---------|
| `AMOUNT_CEILING` | `amount > maxTransactionAmountUSD` |
| `DOMAIN_VIOLATION` | Domain not in `allowedDomains` |
| `VELOCITY_CAP` | Actions in last 60s ≥ `maxActionsPerMinute` |
| `SCOPE_CEILING` | Requested scope in `forbiddenScopes` |
| `COUNTRY_BLOCKED` | Country in `blockedCountries` (OFAC) |
| `DATA_CLASSIFICATION_BLOCKED` | Requested field in `blockedDataFields` |

### Layer 2 Step-Up Triggers (allow with human approval)

| Trigger | Condition |
|---------|-----------|
| Amount threshold | `amount > requiresStepUpAboveUSD` |
| SAR threshold | `amount >= sarThresholdUSD` |
| High-risk country | `country in highRiskCountries` |
| Sensitive data field | `field in requiresStepUpForFields` |
| Irreversible action | Tool name matches irreversible patterns + amount > 0 |

### Layer 4 Violations (post-execution)

| Code | Severity | Action |
|------|----------|--------|
| `SENSITIVE_FIELD_LEAK` | critical | Quarantine |
| `PII_DETECTED` (high confidence) | critical | Quarantine |
| `AMOUNT_DRIFT` (>20%) | critical | Quarantine |
| `AMOUNT_DRIFT` (5-20%) | high | Redact |
| `SCOPE_OVERSHOOT` | high | Redact |
| `ANOMALOUS_VOLUME` (>5x threshold) | high | Redact |
| `ANOMALOUS_VOLUME` (1-5x threshold) | low | Flag only |

---

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

### Step 3: Add to Registry (`src/lib/agent-registry.ts`)

```typescript
const yourAgent: AgentProfile = {
  agentId: 'your-agent-id',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: ['scope:read', 'scope:write'],
  hardLimits: {
    maxTransactionAmountUSD: 1000,
    allowedDomains: ['api.yourservice.com'],
    maxActionsPerMinute: 10,
    forbiddenScopes: ['admin:write'],
    requiresStepUpAboveUSD: 200,
    // Optional — AML-specific:
    // highRiskCountries: ['KY', 'VG'],
    // sarThresholdUSD: 10000,
    // blockedCountries: ['KP'],
    // Optional — HR-specific:
    // allowedDataFields: ['email', 'name'],
    // blockedDataFields: ['salary', 'medical_history'],
    // requiresStepUpForFields: ['id_card'],
    // dataRetentionDays: 90,
  },
  auth0ClientId: '',
  createdAt: new Date(),
  version: '1.0.0',
  isActive: true,
};
registry.set(yourAgent.agentId, yourAgent);
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

### Step 6: Add mock results (`src/lib/token-vault.ts`)

```typescript
your_tool_name: {
  status: 'success',
  result: { ... },
  message: 'Tool executed via Token Vault',
},
```

### Step 7: Create demo script and API route

Copy `src/demo/travel-agent.ts` as template, customize scenarios.
Copy `src/app/api/demo/route.ts` as template for the trigger endpoint.

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

