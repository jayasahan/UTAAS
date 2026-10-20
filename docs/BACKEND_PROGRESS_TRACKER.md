# UTAAS Backend Implementation Progress Tracker

> **Sprint:** Sprint 1 — Requirements & Vertical MVP  
> **Target Feature:** Paper Setting & Marking Payment Claim + Request Tracking & History Engine  
> **Tech Stack:** Node.js (v20+), NestJS, TypeScript, PostgreSQL (v16), TypeORM / Prisma, Swagger  
> **Authoritative Flowchart:** [`Paper setting  marking  assessment payment and examination duty reimbursement.svg`](file:///E:/Projects/UTAAS/Paper%20setting%20%20marking%20%20assessment%20payment%20and%20examination%20duty%20reimbursement.svg)

---

## 📈 Overall Backend Progress: `[█████████████░░░░░░░] 65% (In Progress)`

| Milestone | Status | Target Date | Owner |
| :--- | :---: | :---: | :--- |
| **M1: Backend Scaffolding & Setup** | ✅ Completed | Sprint 1, W1 | Backend / DevOps |
| **M2: Database Schema & Migrations** | ✅ Completed | Sprint 1, W1 | Backend |
| **M3: Identity Adapter & RBAC** | ✅ Completed | Sprint 1, W2 | Backend / DevOps |
| **M4: Paper Marking Submission Engine** | ✅ Completed | Sprint 1, W2 | Backend |
| **M5: 6-Stage Workflow State Machine** | ⏹️ Planned | Sprint 1, W2 | Backend |
| **M6: Tracking & History APIs** | ⏹️ Planned | Sprint 1, W3 | Backend |
| **M7: Automated Tests & Verification** | ⏹️ Planned | Sprint 1, W3 | QA / Backend |

---

## 📋 Detailed Task Checklist

### Milestone 1: Backend Scaffolding & Setup
- [x] Initialize NestJS project in `backend/` directory (`@nestjs/cli`)
- [x] Configure `tsconfig.json`, `eslint`, `prettier`
- [x] Configure environment variable validation via `@nestjs/config` and `class-validator`
- [x] Setup Swagger/OpenAPI documentation at `/api/docs` with `@nestjs/swagger`
- [x] Setup `docker-compose.yml` service for PostgreSQL 16
- [x] Implement global HTTP exception filter and request transformation interceptor
- [x] Add health check endpoint (`GET /api/v1/health`)

### Milestone 2: Database Schema & Core Entities (PostgreSQL)
- [x] Configure database connection (TypeORM / PostgreSQL) and module registration
- [x] Implement `User`, `Role`, and `Department` entities with seed data
- [x] Implement `RequestType` and `WorkflowTemplate` entities (versioned configurations)
- [x] Implement `Request` entity:
  - `id` (UUID PK)
  - `trackingNumber` (Unique, e.g., `UTR-2026-0001`)
  - `status` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `RETURNED_FOR_CORRECTION`, `APPROVED`, `REJECTED`, `SETTLED`)
  - `currentStageKey`
  - `returningOfficerId` (nullable, for direct resubmission)
  - `formData` (JSONB)
  - `totalAmount` (numeric decimal)
- [x] Implement `RequestStageHistory` entity:
  - `stageKey`, `stageName`, `requiredRole`, `stageOrder`
  - `actorId`, `action` (`PENDING`, `APPROVED`, `REJECT_RETURN`, `APPROVE_PAYOUT`)
  - `comments`, `enteredAt`, `completedAt`
- [x] Implement `AuditEvent` entity (Append-Only guarantee):
  - `requestId`, `actorId`, `actionType`, `previousStatus`, `newStatus`, `fieldDiff`, `comment`, `createdAt`
- [x] Create Database Seed Service (`COM`, `CIV`, `EIE`, `MEC` departments; 7 test roles; `PAPER_MARKING` workflow template)
- [x] Add unit test suite for database entities (`entities.spec.ts`)
- [x] Run linting, unit tests, and build verification successfully

### Milestone 3: Authentication & Identity Adapter (Mock University SSO)
- [x] Implement University Identity Adapter pattern (`AuthService` / `IAuthProvider` / `MockUniversityAuthProvider`)
- [x] Support 7 seeded standard university test actors:
  - `lecturer@eng.ruh.ac.lk` (Lecturer, COM Department)
  - `hod.computer@eng.ruh.ac.lk` (Computer Dept HOD)
  - `dean@eng.ruh.ac.lk` (Faculty Dean)
  - `exam.officer@eng.ruh.ac.lk` (Examination Officer)
  - `finance.officer@eng.ruh.ac.lk` (Financial Officer)
  - `asst.bursar@eng.ruh.ac.lk` (Assistant Bursar)
  - `admin@eng.ruh.ac.lk` (System Administrator)
- [x] Implement JWT token issuance (`@nestjs/jwt`, `@nestjs/passport`, `JwtStrategy`)
- [x] Implement `JwtAuthGuard` protecting sensitive endpoints
- [x] Implement `RolesGuard` and `@Roles()` decorator with universal admin bypass
- [x] Implement `DepartmentScopeGuard` (ensures HOD can only act on their department claims)
- [x] Add `@CurrentUser()` parameter decorator for controller injection
- [x] Expose `POST /api/v1/auth/login`, `POST /api/v1/auth/mock-login/:role`, `GET /api/v1/auth/me`, and `GET /api/v1/auth/test-actors`
- [x] Add comprehensive unit test suites (35 unit tests passing)

### Milestone 4: Paper Marking Claim Engine (Vertical Slice)
- [x] Create `CreatePaperMarkingClaimDto` with nested validation (`class-validator`):
  - Course metadata: academic year, semester, course code/title, exam type, examiner role
  - Line items: paper setting, moderation, script marking, practical/oral, second marking
- [x] Implement `FeeCalculationService`:
  - Enforce official circular rates (Paper Setting LKR 3,500; Moderation LKR 2,000; Script Marking LKR 120; Practical Assessment LKR 500/hr; Second Marking LKR 60)
  - Server-side recalculation and tamper-proofing
  - Expose approved circular reference API (`GET /api/v1/requests/paper-marking/rates/circular`)
- [x] Implement `TrackingNumberService` (`UTR-YYYY-XXXX` atomic sequence generation)
- [x] Implement `POST /api/v1/requests/paper-marking/draft` (save/update without workflow trigger)
- [x] Implement `POST /api/v1/requests/paper-marking/submit` (validate, compute, generate tracking number, transition to HOD review with StageHistory & AuditEvent initialization)
- [x] Implement `GET /api/v1/requests/paper-marking/:id` with IDOR prevention and department scoping
- [x] Add unit test suites for fee calculation, tracking numbers, claim service, and controller (55 unit tests passing)

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

## 🛠️ Active Working Branch

```bash
git checkout mvp
git pull origin mvp
git checkout -b feature/backend-paper-marking-claim mvp
```
