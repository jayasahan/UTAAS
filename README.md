# UTAAS — University Teachers' Administrative Automation System

> **Institution:** Faculty of Engineering, University of Ruhuna  
> **Module:** EC 5406 — Third-Year Software Project (2026)  
> **Client:** Dr. Nadeesha Sandamali  
> **Repository:** [https://github.com/jayasahan/UTAAS.git](https://github.com/jayasahan/UTAAS.git)

---

## 📖 Project Overview

The **University Teachers' Administrative Automation System (UTAAS)** is a secure, auditable, and extensible web-based workflow platform designed to replace paper-based administrative processes for university teaching staff and administrative officers.

### Pilot Workflows (Phase 1):
1. **General Reimbursement Claims**: Structured expense rows, receipt attachments, server-side calculations, and multi-tier approval routing.
2. **Paper Setting / Marking & Assessment**: Fee and rate calculations, candidate counts, HOD recommendation, Dean approval, Exam Officer checking, and Finance certification.
3. **Examination Duty Reimbursement**: Duty logs, duration entries, and institutional certification.

---

## 👥 Engineering Team & Roles

| Member | Registration No | Primary Responsibility |
| :--- | :--- | :--- |
| **Hansana H.A.J.** | EG/2023/5624 | Project Coordination / DevOps / Integration |
| **Herath H.M.K.U.** | EG/2023/5634 | Backend / Database / Workflow Engine |
| **Ranawaka P.S.** | EG/2023/5821 | QA / Testing / Security |
| **Fernando A.N.V** | EG/2023/5590 | Frontend / UI/UX / Design System |

---

## 🛠️ Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, NestJS, TypeScript
- **Database:** PostgreSQL (with versioned workflow schemas and append-only audit logs)
- **API Standard:** RESTful APIs documented with OpenAPI / Swagger
- **Containerization & CI/CD:** Docker, Docker Compose, GitHub Actions

---

## 🌿 Git Branching Strategy & Workflow

Our repository follows a structured multi-branch workflow:

```text
main (Protected production releases; requires peer review and passing CI)
 └── dev (Integration and development branch)
      └── mvp (Sprint 1 MVP coordination branch)
           ├── feature/<task-name>   (e.g., feature/loginPage, feature/request-tracking)
           ├── test/<task-name>      (e.g., test/loginPage, test/request-tracking)
           └── bugfix/<task-name>    (e.g., bugfix/timeline-date-format)
```

### Quick Commands

```bash
# Clone the repository
git clone https://github.com/jayasahan/UTAAS.git
cd UTAAS

# Checkout the MVP branch
git fetch origin
git checkout mvp
git pull origin mvp

# Create a new feature or test branch
git checkout -b feature/request-tracking mvp

# Commit using Conventional Commits format
git commit -m "feat(tracking): implement visual stage stepper component"

# Push to remote and open a Pull Request targeting mvp
git push -u origin feature/request-tracking
```

### Commit Message Convention (Conventional Commits)
- `feat(scope): <description>` — New feature
- `fix(scope): <description>` — Bug fix
- `test(scope): <description>` — Adding or updating tests
- `refactor(scope): <description>` — Code refactoring without behavior change
- `docs(scope): <description>` — Documentation only
- `chore(scope): <description>` — Tooling, dependencies, or configuration
