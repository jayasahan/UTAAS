# UTAAS Backend Implementation Progress Tracker

> **Sprint:** Sprint 1 — Requirements & Vertical MVP  
> **Target Feature:** Paper Setting & Marking Payment Claim + Request Tracking & History Engine  
> **Tech Stack:** Node.js (v20+), NestJS, TypeScript, PostgreSQL (v16), TypeORM / Prisma, Swagger  
> **Authoritative Flowchart:** [`Paper setting  marking  assessment payment and examination duty reimbursement.svg`](file:///E:/Projects/UTAAS/Paper%20setting%20%20marking%20%20assessment%20payment%20and%20examination%20duty%20reimbursement.svg)

---

## 📈 Overall Backend Progress: `[░░░░░░░░░░░░░░░░░░░░] 0% (Kickoff)`

| Milestone | Status | Target Date | Owner |
| :--- | :---: | :---: | :--- |
| **M1: Backend Scaffolding & Setup** | ✅ Completed | Sprint 1, W1 | Backend / DevOps |
| **M2: Database Schema & Migrations** | ⏹️ Planned | Sprint 1, W1 | Backend |
| **M3: Identity Adapter & RBAC** | ⏹️ Planned | Sprint 1, W2 | Backend / DevOps |
| **M4: Paper Marking Submission Engine** | ⏹️ Planned | Sprint 1, W2 | Backend |
| **M5: 6-Stage Workflow State Machine** | ⏹️ Planned | Sprint 1, W2 | Backend |
| **M6: Tracking & History APIs** | ⏹️ Planned | Sprint 1, W3 | Backend |
| **M7: Automated Tests & Verification** | ⏹️ Planned | Sprint 1, W3 | QA / Backend |

---

## 📋 Detailed Task Checklist

### Milestone 1: Backend Scaffolding & Setup
- [ ] Initialize NestJS project in `backend/` directory (`@nestjs/cli`)
- [ ] Configure `tsconfig.json`, `eslint`, `prettier`
- [ ] Configure environment variable validation via `@nestjs/config` and `class-validator`
- [ ] Setup Swagger/OpenAPI documentation at `/api/docs` with `@nestjs/swagger`
- [ ] Setup `docker-compose.yml` service for PostgreSQL 16
- [ ] Implement global HTTP exception filter and request transformation interceptor
- [ ] Add health check endpoint (`GET /api/v1/health`)

### Milestone 2: Database Schema & Core Entities (PostgreSQL)
- [ ] Configure database connection (TypeORM / Prisma) and migration scripts
- [ ] Implement `User`, `Role`, and `Department` entities with seed data
- [ ] Implement `RequestType` and `WorkflowTemplate` entities (versioned configurations)
- [ ] Implement `Request` entity:
  - `id` (UUID PK)
  - `tracking_number` (Unique, e.g., `UTR-2026-0001`)
  - `status` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `RETURNED_FOR_CORRECTION`, `APPROVED`, `REJECTED`, `SETTLED`)
  - `current_stage_key`
  - `returning_officer_id` (nullable, for direct resubmission)
  - `form_data` (JSONB)
- [ ] Implement `RequestStageHistory` entity:
  - `stage_key`, `stage_name`, `required_role`, `stage_order`
  - `actor_id`, `action` (`PENDING`, `APPROVED`, `REJECT_RETURN`, `APPROVE_PAYOUT`)
  - `comments`, `entered_at`, `completed_at`
- [ ] Implement `AuditEvent` entity (Append-Only guarantee):
  - `request_id`, `actor_id`, `action_type`, `previous_status`, `new_status`, `field_diff`, `comment`, `created_at`
- [ ] Run initial migration and verify tables in PostgreSQL

### Milestone 3: Authentication & Identity Adapter (Mock University SSO)
- [ ] Implement University Identity Adapter pattern (`AuthService` / `MockAuthProvider`)
- [ ] Seed standard university test actors:
  - `lecturer@eng.ruh.ac.lk` (Lecturer)
  - `hod.computer@eng.ruh.ac.lk` (Computer Dept HOD)
  - `dean@eng.ruh.ac.lk` (Faculty Dean)
  - `exam.officer@eng.ruh.ac.lk` (Examination Officer)
  - `finance.officer@eng.ruh.ac.lk` (Financial Officer)
  - `asst.bursar@eng.ruh.ac.lk` (Assistant Bursar)
- [ ] Implement JWT token generation & `JwtAuthGuard`
- [ ] Implement `RolesGuard` and `@Roles()` decorator
- [ ] Implement `DepartmentScopeGuard` (ensures HOD can only act on their department claims)

### Milestone 4: Paper Setting & Marking Claim Engine (Vertical Slice)
- [ ] Create `CreatePaperMarkingClaimDto` with nested validation (`class-validator`):
  - Course metadata: academic year, semester, course code/title, exam type, examiner role
  - Line items: paper setting, moderation, script marking, practical/oral, second marking
- [ ] Implement `FeeCalculationService`:
  - Enforce official circular rates
  - Server-side recalculation and tamper-proofing
- [ ] Implement `POST /api/v1/requests/paper-marking/draft` (save without workflow trigger)
- [ ] Implement `POST /api/v1/requests/paper-marking/submit` (validate, compute, generate tracking number, transition to HOD review)
- [ ] Implement mock file attachment handler for marking sheets / appointment letters

### Milestone 5: 6-Stage Workflow State Machine & Transition Actions
- [ ] Implement atomic state machine transaction (`EntityManager.transaction`):
  - Transitions `Request.status`
  - Closes active `RequestStageHistory` row and opens next stage
  - Inserts append-only `AuditEvent` record
- [ ] Support Transition Actions:
  - [ ] **`SUBMIT`**: Transitions `DRAFT` ➔ `UNDER_REVIEW` (Stage: `HEAD_OF_DEPARTMENT`)
  - [ ] **`APPROVE`**: Advances `HOD` ➔ `DEAN` ➔ `EXAMINATION_OFFICE`
  - [ ] **`REJECT_RETURN`**:
    - HOD returns to Lecturer
    - Exam Office returns to HOD
    - Financial Office returns to HOD
  - [ ] **`APPROVE_PAYOUT`**: Financial Office approves and routes to Assistant Bursar
  - [ ] **`DIRECT_QUERY`**: Allows Lecturer to communicate directly with Exam / Financial office
  - [ ] **`RESUBMIT`**: Lecturer corrections route directly back to the returning office (Blue line)

### Milestone 6: Request Tracking & Audit History Endpoints
- [ ] Implement `GET /api/v1/requests/:id/tracking`:
  - Returns `trackingNumber`, current status, active stage, and ordered list of stages with completion statuses & timestamps
- [ ] Implement `GET /api/v1/requests/:id/history`:
  - Returns complete chronological audit logs, reviewer comments, and before/after diffs
- [ ] Implement `GET /api/v1/requests/my-requests`:
  - Paginated list of claims submitted by logged-in lecturer
- [ ] Implement `GET /api/v1/requests/pending-queue`:
  - Work queue for current reviewer role, scoped by department where applicable

### Milestone 7: Automated Testing & Definition of Done (DoD)
- [ ] Unit tests for `FeeCalculationService` (boundary rates, multi-item claims)
- [ ] Unit tests for `WorkflowStateMachine` (state invariants, invalid transition rejection)
- [ ] Integration tests for Tracking and History endpoints (`Supertest`)
- [ ] Test matrix execution (TC-WF-01 to TC-WF-10):
  - Non-linear resubmissions verified
  - Department boundary isolation verified (HOD cannot approve other dept)
  - IDOR protection verified (Lecturer A cannot inspect Lecturer B tracking)
- [ ] Swagger API documentation validated against actual response schemas

---

## 🛠️ Active Working Branch for Backend Kickoff

```bash
# Branch off mvp for backend scaffolding
git checkout mvp
git pull origin mvp
git checkout -b feature/backend-scaffold mvp
```
