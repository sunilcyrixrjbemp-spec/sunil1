# Cyrix FieldOps — Master Architecture Audit & Implementation Plan

> **Audit Date:** 2026-08-06 | **Auditor:** Senior Full-Stack Engineer
> **Codebase:** sunilcyrixrjbemp-spec/sunil1
> **Stack:** React + TypeScript + Vite + Tailwind + Ant Design v5 (frontend), Cloudflare Worker + D1 + R2 + Queues (backend)

---

## 1. CURRENT ARCHITECTURE

### 1.1 Repository Structure

```
Sunil React.tsx/              <- Root (Cloudflare Pages: sunil1)
├── wrangler.toml             <- Pages-only config (pages_build_output_dir only)
├── frontend/                 <- React SPA (Vite + TS + Tailwind + AntD v5)
│   └── src/
│       ├── pages/            <- 24 page files (ExpensePage 375KB, AdminPage 192KB)
│       ├── components/       <- common/, admin/, approval/, expense/, auth/
│       ├── services/         <- api.ts (axios) + per-domain service files
│       ├── utils/            <- timezone.ts, persistence.ts, capacitor.ts
│       └── hooks/            <- useCurrentTimeIST, useFCMNotifications
└── worker-backend/           <- Cloudflare Worker (SINGLE SERVER - already consolidated)
    ├── wrangler.toml         <- Full Worker config (D1, KV, R2, Queues, Email)
    └── src/
        ├── index.js          <- Entry point + Router (717 lines)
        ├── routes/           <- 11 route handlers
        ├── db/               <- schema.js (30 tables), client.js
        ├── email/            <- sender.js (MailChannels), templates.js
        ├── queues/           <- analyticsProcessor.js, uploadProcessor.js
        └── utils/            <- r2Storage.js, security.js, timestamp.js, etc.
```

### 1.2 Server Architecture (Current State)

**GOOD NEWS: Server is ALREADY consolidated (Part 1 is DONE).**
There is ONE Cloudflare Worker (fieldops-api) serving all routes.
The root wrangler.toml is ONLY for Cloudflare Pages (frontend hosting).

- Frontend: Cloudflare Pages at https://indrae.in (via sunil1 Pages project)
- Backend: Cloudflare Worker (name = "fieldops-api")
- API Base (frontend): `https://fieldops-secondary-api.sunilbishnoi.workers.dev`
  -- *** STALE/OLD URL *** in api.ts line 6 — this is a LIVE PRODUCTION BUG

### 1.3 Database Schema (30 Tables — Cloudflare D1 SQLite)

| # | Table | Purpose |
|---|-------|---------|
| 1 | users | Employees + hierarchy fields |
| 2 | user_roles | Role overrides per user |
| 3 | otps | OTP codes (KV-backed too) |
| 4 | login_logs | Auth audit trail |
| 5 | support_tickets | Help desk tickets |
| 6 | system_settings | Key-value config store |
| 7 | asset_value_master | Equipment RMSC costs |
| 8 | assets_inventory | Hospital equipment records |
| 9 | kpi_appraisals | Monthly KPI data |
| 10 | legacy_hash_mapping | Old expense ID to new ID |
| 11 | password_histories | Password reuse prevention |
| 12 | expenses | Main expense header records |
| 13 | expense_master | Legacy expense table |
| 14 | expense_itineraries | Per-leg travel details |
| 15 | expense_asset_taggings | Asset tagging per itinerary |
| 16 | approvals | Approval records |
| 17 | approval_hierarchies | Named hierarchy groups |
| 18 | hierarchy_requesters | Who belongs to each hierarchy |
| 19 | hierarchy_approvers | Approvers per level per hierarchy |
| 20 | limit_approval_requests | KM/Auto limit extension |
| 21 | allowance_master | Grade-wise TA/DA rates |
| 22 | facility_details | Hospital list per district |
| 23 | rj_penalties | Penalty records |
| 24 | no_ta_da_hospitals | TA/DA exclusion list |
| 25 | file_metadata | R2 upload tracking |
| 26 | audit_logs | Immutable action log |
| 27 | analytics_events | Usage tracking |
| 28 | email_logs | Email delivery tracking |
| 29 | system_metrics | Worker performance metrics |
| 30 | approval_tokens | One-click email approval tokens |

### 1.4 Complete Route Inventory

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | /api/auth/login | handleLogin | No |
| POST | /api/auth/refresh | handleRefresh | No |
| GET | /api/auth/bootstrap | handleBootstrap | Yes |
| POST | /api/auth/logout | handleLogout | Yes |
| GET | /api/auth/dropdowns | handleGetDropdowns | No |
| POST | /api/auth/forgot-password | handleForgotPassword | No |
| POST | /api/auth/verify-otp | handleVerifyOtp | No |
| POST | /api/auth/reset-password | handleResetPassword | No |
| POST | /api/auth/unlock-account | handleUnlockAccount | No |
| GET | /api/users/profile | handleGetProfile | Yes |
| PUT | /api/users/profile | handleUpdateProfile | Yes |
| POST | /api/users/profile/photo | handleUploadProfilePhoto | Yes |
| DELETE | /api/users/profile/photo | handleDeleteProfilePhoto | Yes |
| POST | /api/users/change-password | handleChangePassword | Yes |
| GET | /api/approval[s] | handleGetApprovals | Yes |
| POST | /api/approval[s]/bulk-approve | handleBulkApprove | Yes |
| POST | /api/approval[s]/:id/approve | handleApprove | Yes |
| POST | /api/approval[s]/:id/reject | handleReject | Yes |
| POST | /api/approval[s]/:id/return-to-draft | handleReturnToDraft | Yes |
| GET | /api/admin/... (20+ routes) | various | Yes+Admin |
| GET/POST | /api/ticket[s]/... (9 routes) | ticket handlers | Yes |
| POST | /api/upload/image | handleUploadImage | Yes |
| POST | /api/upload/document | handleUploadDocument | Yes |
| GET | /api/r2/file/*, /api/files/* | handleServeFile | No |
| DELETE | /api/files/:key | handleDeleteFile | Yes |
| GET | /api/reports/... (8 routes) | report handlers | Yes |
| GET | /api/attendance/... (3 routes) | attendance handlers | Yes |
| GET | /api/expense/init | handleExpenseInit | Yes |
| GET | /api/expense/team | handleGetTeamExpenses | Yes |
| GET | /api/expense/:id | handleGetExpenseDetails | Yes |
| POST | /api/expense | handleSubmitExpense | Yes |
| DELETE | /api/expense/:id | handleDeleteExpense | Yes |
| POST | /api/expense/evaluate-policy | handleEvaluatePolicy | Yes |
| POST | /api/expense/retroactive-policy-check | handleRetroactiveBasePolicyCheck | Yes |
| GET | /api/expense/email-action | handleEmailAction | No (signed token) |

### 1.5 Queue Configuration (Already in wrangler.toml)

- fieldops-uploads-queue → uploadProcessor.js (max_batch_size=10, retries=3, DLQ)
- fieldops-email-queue → sender.js::processEmailBatch (max_batch_size=5, retries=3, DLQ)
- fieldops-analytics-queue → analyticsProcessor.js (max_batch_size=50, retries=2, DLQ)
- fieldops-dlq → Dead letter queue

### 1.6 Email System (Already Implemented)

- Primary: MailChannels API (https://api.mailchannels.net/tx/v1/send) — works on Workers free
- Fallback: Cloudflare native env.EMAIL_SENDER binding (configured in wrangler.toml)
- Queue retry: 3 retries before DLQ
- DB tracking: email_logs table records every send attempt

---

## 2. ROOT CAUSE ANALYSIS — ALL BUGS

### Bug A: "Base Policy" Showing Incorrectly (Part 8)

**Root Cause:**
computeBaseLocPolicy() in expense.js returns {isBaseLocOnly, isDaAllowed, baseLocations}
but does NOT return which of the 5 cases (1-5) was triggered.

The handleSubmitExpense response includes deductions.policyMessage (text string) at submit
time only. This is NOT stored in the DB — the expenses table has no policy_case column.

When GET /expense/:id is called later, the response has no policy_case or applied_rule_name.
The frontend (ClaimDetailsModal — LOCKED) shows a generic "Base Policy" label for all
deductions because it has no way to distinguish which specific rule applied.

**Fix Needed:**
- Add policy_case INTEGER and policy_rule_name TEXT columns to expenses table
- In handleSubmitExpense: compute and persist policy case + rule name
- In handleGetExpenseDetails: include policy_case and policy_rule_name in response
- The modal will then display the correct specific rule instead of generic "Base Policy"
- NOTE: expense.js is LOCKED — password required to implement this fix

### Bug B: Approval Flow / Stuck Claims (Part 9)

**Root Cause:**
1. handleApprove in approval.js increments level_number to look up next approver.
   If hierarchy_approvers has no level-2 entry for that hierarchy, the claim is set to
   pending_l2 status but no one can ever approve it — it is permanently stuck.
2. Timestamp storage is inconsistent: some paths use new Date().toLocaleString() (IST local
   string) instead of new Date().toISOString() (UTC). Chronological sorting and SLA
   calculation (hours since submission) are both broken when IST strings are compared.
3. handleRepairStuckApprovals in admin.js exists but is manual-only (admin clicks a button).
   There is no automated SLA-based cron trigger.

**Fix Needed:**
- All timestamps: store as UTC ISO string only; display in IST on frontend
- Add state-machine enum validation before any approval status transition
- Enable Cron Triggers in wrangler.toml for automated SLA escalation

### Bug C: Stale API Base URL — LIVE PRODUCTION BUG

**Root Cause:**
frontend/src/services/api.ts line 6:
  const WORKER_BACKEND_URL = "https://fieldops-secondary-api.sunilbishnoi.workers.dev";

The actual deployed worker name is "fieldops-api" per worker-backend/wrangler.toml.
Any request using the fallback URL hits a non-existent or wrong worker = 404 errors.

**Fix Needed:** Update line 6 to the correct worker URL.

### Bug D: Missing Deduction Traceability (Part 6)

**Root Cause:**
No expense_deductions table exists in the schema.
All deduction information is stored as unstructured text strings in expense_edit_logs
(e.g., "[Policy] Base: Jodhpur — Commute TA 120 not eligible").
There is no queryable, structured record of "which rule, which user, which amount, which leg."

**Fix Needed:** New expense_deductions table via migration.

### Bug E: Photos Not Lazy-Loaded (Part 3)

**Root Cause:**
handleServeFile in upload.js returns the full R2 object body immediately on every
request. No thumbnail endpoint exists, no format negotiation (AVIF/WebP), no lazy-load
pattern. The frontend modal loads all photos eagerly when it opens.

**Fix Needed:** Add ?thumb=1 query param + Accept header-based format selection in upload.js.

---

## 3. MISSING DB TABLES AND COLUMNS

### New Tables (Migration v3)

```sql
-- Deduction traceability (Part 6)
CREATE TABLE IF NOT EXISTS expense_deductions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id    INTEGER NOT NULL,
  expense_code  TEXT,
  user_id       TEXT NOT NULL,
  rule_case     INTEGER,          -- 1-5 per locked policy, NULL = admin manual
  rule_name     TEXT NOT NULL,    -- e.g. "Home->Base commute", "Base-only day (no DA)"
  category      TEXT NOT NULL,    -- "TA" | "DA" | "Hotel" | "Other" | "Admin"
  original_amt  REAL DEFAULT 0.0,
  deducted_amt  REAL DEFAULT 0.0,
  approved_amt  REAL DEFAULT 0.0,
  reason        TEXT,
  applied_by    TEXT DEFAULT 'system',
  itinerary_id  TEXT,
  leg_number    INTEGER,
  created_at    TEXT NOT NULL
);

-- Queue job tracking (Part 4)
CREATE TABLE IF NOT EXISTS expense_queue_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id    INTEGER NOT NULL,
  job_type      TEXT NOT NULL,    -- "policy_validate" | "email_notify" | "anomaly_check"
  status        TEXT DEFAULT 'queued',
  attempts      INTEGER DEFAULT 0,
  last_error    TEXT,
  queued_at     TEXT NOT NULL,
  completed_at  TEXT,
  created_at    TEXT NOT NULL
);
```

### New Columns on expenses Table

```sql
ALTER TABLE expenses ADD COLUMN policy_case INTEGER;
ALTER TABLE expenses ADD COLUMN policy_rule_name TEXT;
ALTER TABLE expenses ADD COLUMN queue_job_id TEXT;
ALTER TABLE expenses ADD COLUMN processing_status TEXT DEFAULT 'complete';
```

---

## 4. PER-PART STATUS AUDIT

| Part | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Server Consolidation | DONE | Fix stale WORKER_BACKEND_URL in api.ts |
| 2 | Email via Cloudflare | DONE | Verify Email Routing enabled in Dashboard |
| 3 | R2 + Lazy Load + Format | PARTIAL | No thumb/AVIF/WebP; upload.js not locked |
| 4 | Queues for Speed | PARTIAL | Submit synchronous; no expense processor |
| 5 | Paid Plan Add-ons | PARTIAL | Crons commented out; Images not configured |
| 6 | Deduction Integrity | MISSING | No expense_deductions table |
| 7 | Remove AI Popup | UNLOCATED | AI/anomaly not found in searched files |
| 8 | Fix Base Policy Display | BUG | expense.js LOCKED; policy_case not persisted |
| 9 | Approval Flow Fix | PARTIAL | Mixed timestamps; no state machine |
| 10 | Ultra Fast App | NOT DONE | No SWR/React Query; no KV caching |
| 11 | Git Branch Merge | PENDING | updates-by-sunny behind main; needs rebase |
| 12 | Credentials Cleanup | MOSTLY DONE | Verify .dev.vars in .gitignore |

---

## 5. MIGRATION PLAN (Step-by-Step with Rollback Notes)

### Phase 0 — Pre-work (no code changes)
- [ ] Verify .dev.vars exists and is in .gitignore
- [ ] Confirm `wrangler secret put ADMIN_PASSWORD` was run
- [ ] Confirm Email Routing enabled for noreply@indrae.in in Cloudflare Dashboard
- [ ] Run `wrangler queues list` to verify all 4 queues exist
- Rollback: N/A

### Phase 1 — DB Schema Migrations (additive, safe)
Commit: "migration: add expense_deductions and expense_queue_jobs tables"
Files:
  - worker-backend/src/utils/db-migrate-v3.js  [NEW]
  - worker-backend/src/db/schema.js            [MODIFY - 2 new tables + 4 columns]
  - worker-backend/src/index.js               [MODIFY - register v3 migration route]
Rollback: DROP TABLE expense_deductions; DROP TABLE expense_queue_jobs; (additive only)

### Phase 2 — Fix Stale API URL (not locked, immediate impact)
Commit: "fix: update WORKER_BACKEND_URL to correct fieldops-api worker domain"
Files:
  - frontend/src/services/api.ts              [MODIFY line 6]
  - frontend/.env                             [MODIFY VITE_API_BASE_URL]
  - frontend/.env.example                    [MODIFY]
Rollback: Revert line 6 (single-line change)

### Phase 3 — Policy Case Persistence (LOCKED FILES — password required)
Commit: "feat: persist policy_case and rule_name on expense submit"
Files:
  - worker-backend/src/routes/expense.js     [LOCKED - requires password]
Rollback: Revert expense.js changes + run ALTER TABLE expenses DROP COLUMN

### Phase 4 — R2 Lazy Load + Format Negotiation (not locked)
Commit: "feat: add thumbnail endpoint and AVIF/WebP format negotiation"
Files:
  - worker-backend/src/routes/upload.js      [MODIFY]
  - worker-backend/src/utils/r2Storage.js    [MODIFY]
Rollback: Remove ?thumb=1 logic; format negotiation is additive

### Phase 5 — Queue-First Expense Submit (LOCKED — password required)
Commit: "feat: queue-first expense submit with D1 atomic batch write"
Files:
  - worker-backend/src/routes/expense.js     [LOCKED - requires password]
  - worker-backend/src/queues/expenseProcessor.js  [NEW]
Rollback: Revert expense.js; delete expenseProcessor.js

### Phase 6 — Enable Cron Triggers (wrangler.toml, not locked)
Commit: "feat: enable scheduled cron triggers for SLA escalation and digests"
Files:
  - worker-backend/wrangler.toml             [MODIFY - uncomment triggers block]
Rollback: Re-comment the triggers block

### Phase 7 — KV Caching for Auth Dropdowns (auth.js, not locked)
Commit: "feat: KV-cache auth dropdowns with 1h TTL"
Files:
  - worker-backend/src/routes/auth.js        [MODIFY]
Rollback: Remove KV cache logic from auth.js

### Phase 8 — Frontend Prefetch Layer (not locked)
Commit: "feat: prefetch user profile and master data after login"
Files:
  - frontend/src/App.tsx                     [MODIFY]
Rollback: Remove prefetch useEffect calls

### Phase 9 — Branch Merge
```bash
git checkout updates-by-sunny
git rebase main
# manually resolve any conflicts
git checkout main
git merge updates-by-sunny --no-ff -m "merge: integrate updates-by-sunny into main"
git push origin main
```
Rollback: git revert <merge-commit-hash>

---

## 6. RISK REGISTER

| Risk | Severity | Part | Mitigation |
|------|----------|------|-----------|
| expense.js LOCKED - base policy fix impossible without password | HIGH | 3,5,8 | Password needed from user |
| ClaimDetailsModal.tsx LOCKED - AI popup location unknown | HIGH | 7 | Search all unlocked files first |
| Stale WORKER_BACKEND_URL in api.ts -> production 404s | HIGH | 1 | Fix immediately (file not locked) |
| Queue-first changes expense submit response pattern | MEDIUM | 4 | ENABLE_QUEUES feature flag exists |
| Format negotiation may break existing email image links | MEDIUM | 3 | ?thumb=1 is additive; default unchanged |
| Rebase of updates-by-sunny may produce conflicts | MEDIUM | 11 | Manual resolution required |
| Cron re-enable may cause duplicate auto-approval runs | LOW | 9 | handleAutoApprovalExpiry is idempotent |
| Partial write to D1 on expense submit if Worker CPU limit hit | MEDIUM | 4 | Use D1 batch() for atomic writes |

---

## 7. ALREADY WORKING — DO NOT TOUCH

- Single Cloudflare Worker consolidation (fieldops-api)
- Email via MailChannels + Cloudflare Email Workers binding
- R2 upload pipeline with SHA-256 duplicate detection
- Queue setup in wrangler.toml (all 4 queues)
- D1 database with all 30 tables
- JWT auth + refresh token + session management
- OTP system (KV-backed, auto-expiring)
- Global IP rate limiting + login rate limiting
- Approval hierarchy system + bulk approval
- 5-case TA/DA locked policy (computeBaseLocPolicy) - DO NOT MODIFY LOGIC
- Post-rejection email hook (index.js lines 527-609)
- Security headers + CORS header injection

---

## 8. OPEN QUESTIONS (Must be answered before implementation)

Q1 - Part 7 (AI Analysis Popup):
  After searching ClaimDetailsModal.tsx, ExpensePage.tsx, and HomePage.tsx for "AI",
  "anomaly", "artificial", "analysis" - NO AI popup code was found in these files.
  Can you describe what this popup looks like and which page/action triggers it?
  We need to find the exact component before we can remove it.

Q2 - Locked Files Password (Parts 3, 5, 8):
  expense.js is a LOCKED file per AGENTS.md.
  The following CANNOT be done without the password:
  (a) Base policy case persistence fix (Part 8)
  (b) Queue-first expense submit (Part 4/5)
  (c) Deduction traceability write calls in expense.js
  Please provide the password if you want these changes.

Q3 - Part 5 (Cloudflare Images):
  Should we use Cloudflare Images (paid addon, automatic AVIF/WebP) or implement
  Worker-side format conversion using fetch(url, {cf:{image:{...}}}) options?

Q4 - Part 9 (Cron Triggers):
  Crons are commented out in wrangler.toml. Re-enabling starts:
  - Auto-approval expiry: 00:00 UTC daily (05:30 AM IST)
  - Manager digest emails: 04:30 UTC (10:00 AM IST)
  - Daily cleanup: 18:00 UTC (11:30 PM IST)
  Confirm you want all three enabled.

Q5 - Part 11 (Branch Merge):
  updates-by-sunny branch contains KPI auto-metrics, monthly stats pending claims,
  role permissions, and sidebar UI fixes. Its base is behind main by ~20 commits.
  Should we rebase and merge it?

Q6 - fieldops-secondary-api URL:
  Is https://fieldops-secondary-api.sunilbishnoi.workers.dev still deployed and live?
  Or is it completely dead/deleted? This affects urgency of the api.ts fix.

Q7 - Part 10 (React Query vs lightweight cache):
  Installing React Query is a significant dependency change.
  Alternative: add a lightweight in-memory cache in api.ts.
  Which approach do you prefer?

Q8 - Part 4 (Queue scope):
  Should queue-first pattern apply only to new submissions going forward?
  Or should existing pending claims also be re-processed through the queue?

---

## 9. RECOMMENDED EXECUTION ORDER

IMMEDIATE (no locked files, no password needed):
  Phase 0  - Pre-work verification
  Phase 2  - Fix stale WORKER_BACKEND_URL (LIVE BUG - do this first)
  Phase 6  - Enable Cron Triggers

SAFE ADDITIONS (no locked files):
  Phase 1  - DB migrations (additive, zero breaking changes)
  Phase 4  - R2 lazy load + format negotiation (upload.js not locked)
  Phase 7  - KV cache for auth dropdowns (auth.js not locked)
  Phase 8  - Frontend prefetch layer (App.tsx not locked)

REQUIRES PASSWORD (locked files):
  Phase 3  - Policy case persistence (expense.js)
  Phase 5  - Queue-first expense submit (expense.js)

GIT:
  Phase 9  - Branch merge (updates-by-sunny)

FINAL:
  Full regression test + smoke test checklist

---

## 10. SMOKE TEST CHECKLIST (Post-implementation)

Auth:
  [ ] Login with valid credentials -> access token received
  [ ] 5 failed logins -> account locked + unlock flow
  [ ] OTP reset -> email received in inbox (not spam)
  [ ] Token expiry -> silent refresh, no logout

Expense:
  [ ] Submit expense -> immediate 200 response (queue-first)
  [ ] Base location trip -> specific policy case name shown (not generic "Base Policy")
  [ ] Out-district trip -> no deduction applied
  [ ] Photo upload -> R2 URL returned
  [ ] Photo click -> thumbnail loads first, then full image (lazy)
  [ ] WebP/AVIF served when Accept header includes these formats
  [ ] expense_deductions row created in DB after submission

Approval:
  [ ] L1 approve -> expense moves to L2 pending
  [ ] L2 approve -> expense moves to Approved, employee notified
  [ ] L2 reject -> employee gets rejection email with reason
  [ ] One-click email approve link -> claim approved after token validation

Admin:
  [ ] Repair stuck approvals admin tool -> stuck claims resolved
  [ ] Cron fires at scheduled time -> check Cloudflare Logs (Workers > fieldops-api > Logs)

DB Integrity:
  [ ] Simulate error mid-expense-write (disconnect DB) -> no partial row in DB
  [ ] expense_deductions table populated correctly after submission
  [ ] policy_case and policy_rule_name fields saved on expenses table

---

*Plan generated from full codebase audit on 2026-08-06.*
*Do NOT begin implementation until this plan is reviewed and approved by the user.*
