# Frontend Developer Guide: Examination Paper Structures, Quota Validation & Proportion Consensus

## 1. Overview
To ensure compliance with Faculty of Engineering regulations and UGC Circulars, the backend now features:
1. **Authoritative Paper Structure Registration**: First lecturer submitting for an examination paper sets the official question count, MCQ questions, duration, and candidate numbers.
2. **Cross-Examiner Quota Validation**: Multiple examiners for the same paper (e.g., co-setters, markers) cannot exceed the total question limit, duplicate moderation, or exceed typing allowances.
3. **Paper Structure Correction & Step 1 Reset**: If the first lecturer made an error in the question count, they (or HOD/Admin) can edit it. Editing invalidates all downstream officer approvals and automatically resets the claim back to **Step 1 (Head of Department)**.
4. **Combined (MCQ + Essay) HOD Proportion Division & Consensus**: For combined papers, the HOD specifies the component proportion (e.g., Essay 60%, MCQ 40%). The proposed division is dispatched to lecturers for agreement. If any lecturer disagrees, their feedback returns the claim to the HOD for adjustment.

---

## 2. API Endpoints Reference

### 2.1 Get Authoritative Paper Structure & Quota Breakdown
```http
GET /api/v1/requests/paper-marking/paper-structure?courseCode=EC5060&academicYear=2023/2024&semester=Semester 1&examType=End Semester Examination
```

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `courseCode` | `string` | **Yes** | e.g. `EC5060`, `IS5302`, `CE2010` |
| `academicYear` | `string` | **Yes** | e.g. `2023/2024` |
| `semester` | `string` | **Yes** | e.g. `Semester 1` or `5` |
| `examType` | `string` | **Yes** | e.g. `End Semester Examination` |

#### Response (`200 OK`):
```json
{
  "exists": true,
  "paperStructure": {
    "id": "7f8b9c1a-...",
    "courseCode": "EC5060",
    "courseTitle": "Software Engineering Project",
    "academicYear": "2023/2024",
    "semester": "Semester 1",
    "examType": "End Semester Examination",
    "paperType": "COMBINED",
    "paperDurationHours": 3,
    "totalQuestions": 5,
    "totalMcqQuestions": 30,
    "totalCandidates": 120,
    "essayWeightPercent": 60,
    "mcqWeightPercent": 40,
    "registeredByName": "Dr. Hansana H.A.J.",
    "registeredByEmail": "hansana@eng.ruh.ac.lk",
    "createdAt": "2026-11-04T12:00:00.000Z"
  },
  "claimsBreakdown": {
    "setting": {
      "totalQuestions": 5,
      "claimedQuestions": 3,
      "remainingQuestions": 2,
      "isFullPaperClaimed": false,
      "claimants": [
        {
          "examinerId": "user-uuid-1",
          "examinerName": "Dr. Hansana H.A.J.",
          "examinerEmail": "hansana@eng.ruh.ac.lk",
          "questionsClaimed": 3,
          "proportion": 0.6,
          "trackingNumber": "UTR-2026-0001",
          "status": "UNDER_REVIEW"
        }
      ]
    },
    "moderation": {
      "isClaimed": true,
      "claimedBy": "Dr. Hansana H.A.J."
    },
    "typing": {
      "isClaimed": true,
      "typedPagesClaimed": 4,
      "claimedBy": "Dr. Hansana H.A.J."
    },
    "scriptMarking": {
      "totalCandidates": 120,
      "totalScriptsClaimed": 120,
      "totalQuestionsMarked": 5,
      "remainingQuestionsPerScript": 0,
      "claimants": []
    }
  },
  "hodProportionDivision": {
    "essayWeightPercent": 60,
    "mcqWeightPercent": 40,
    "status": "AWAITING_LECTURER_CONSENSUS",
    "setByHodName": "Prof. J.K. HOD",
    "comments": "Essay section comprises 60%, MCQ comprises 40%."
  },
  "structureChangeHistory": []
}
```

> **When `exists === false`**:
> The first lecturer submitting will establish the structure. In the UI, show editable inputs for `totalQuestions`, `paperDurationHours`, `totalCandidates`, and `totalMcqQuestions`.

---

### 2.2 Correct Question Structure & Reset Approval to Step 1
```http
PATCH /api/v1/requests/paper-marking/paper-structure
```

#### Request Body:
```json
{
  "courseCode": "EC5060",
  "academicYear": "2023/2024",
  "semester": "Semester 1",
  "examType": "End Semester Examination",
  "totalQuestions": 4,
  "totalMcqQuestions": 30,
  "totalCandidates": 120,
  "paperDurationHours": 3,
  "correctionReason": "Question paper contained 4 compulsory design questions rather than 5."
}
```

#### Important UI Rule:
- Show a **Warning Modal** before submitting this request:
  > *"Modifying the examination question structure will revoke all downstream officer approvals and reset the claim back to Step 1 (Head of Department) for fresh re-approval. Do you wish to continue?"*

#### Error Responses:
- `400 Bad Request`: If `totalQuestions` is lower than questions already claimed by other examiners.
- `403 Forbidden`: If caller is not the lecturer who established the paper, HOD, or Admin.

---

### 2.3 Head of Department Proportion Division (MCQ + Essay)
```http
POST /api/v1/requests/paper-marking/hod-proportion-division
```

#### Request Body:
```json
{
  "courseCode": "EC5060",
  "academicYear": "2023/2024",
  "semester": "Semester 1",
  "examType": "End Semester Examination",
  "essayWeightPercent": 60,
  "mcqWeightPercent": 40,
  "comments": "Essay comprises 60% with 4 design questions, MCQ comprises 40% with 30 questions."
}
```

#### Rules:
- `essayWeightPercent + mcqWeightPercent` must equal exactly `100`.
- Calling this transitions the claim to `currentStageKey: 'LECTURER_PROPORTION_CONSENSUS'` and notifies all co-examiners.

---

### 2.4 Lecturer Proportion Consensus Submission
```http
POST /api/v1/requests/paper-marking/proportion-consensus
```

#### Request Body (Agree):
```json
{
  "courseCode": "EC5060",
  "academicYear": "2023/2024",
  "semester": "Semester 1",
  "examType": "End Semester Examination",
  "agreed": true,
  "comments": "Agreed with 60/40 proportion distribution."
}
```

#### Request Body (Disagree):
```json
{
  "courseCode": "EC5060",
  "academicYear": "2023/2024",
  "semester": "Semester 1",
  "examType": "End Semester Examination",
  "agreed": false,
  "comments": "Essay section was significantly longer and covered 75% of marks. Recommend 75/25 split."
}
```

#### Rules:
- If `agreed === false`, `comments` is **mandatory**.
- When an examiner disagrees, the claim is returned to `HEAD_OF_DEPARTMENT` with the feedback banner displayed.
- When all examiners agree, the proportion is locked, fees are recalculated automatically, and the claim moves to `HEAD_OF_DEPARTMENT` for formal recommendation.

---

## 3. Frontend UI Workflow Integration Guidelines

### Flow A: Dynamic Claim Form (Step 3: Paper Configuration)
1. When user selects **Academic Year**, **Semester**, **Course Code**, and **Exam Type**:
   - Call `GET /api/v1/requests/paper-marking/paper-structure`.
2. **If `exists === true`**:
   - Display banner: `Paper structure established by ${data.registeredBy.name}`.
   - Lock `totalQuestions` field to read-only (`data.paperStructure.totalQuestions`).
   - For Paper Setting questions claimed:
     - Set input max attribute: `max={data.claimsBreakdown.setting.remainingQuestions}`.
     - Show badge: `${data.claimsBreakdown.setting.remainingQuestions} questions remaining`.
   - If `data.claimsBreakdown.moderation.isClaimed === true`:
     - Disable Moderation checkbox/input and show badge: `Already claimed by ${data.claimsBreakdown.moderation.claimedBy}`.
   - If `data.claimsBreakdown.typing.isClaimed === true`:
     - Disable Typing input and show badge: `Already claimed by ${data.claimsBreakdown.typing.claimedBy}`.
3. **If `exists === false`**:
   - Enable editable inputs so the first lecturer can enter `totalQuestions`, `paperDurationHours`, `totalCandidates`, and MCQ counts.

---

### Flow B: Lecturer / HOD Correction Button
- On claim detail / draft pages:
  - If current user is `registeredById` (or HOD/Admin):
  - Show button: **"Edit Paper Question Structure"**.
  - Clicking opens a dialog displaying the current structure, inputs to correct numbers, and mandatory textarea for **Correction Reason**.
  - On confirm, sends `PATCH /api/v1/requests/paper-marking/paper-structure`.
  - On success, displays notification:
    > *"Question structure updated. Downstream approvals revoked and reset to Step 1 (Head of Department) for re-approval."*

---

### Flow C: Combined Paper HOD Action (HOD Review Screen)
- When a claim is at `HEAD_OF_DEPARTMENT` stage and has MCQ + Essay (`paperType === 'COMBINED'` or `totalMcqQuestions > 0`):
- Show dedicated panel: **"Proportion Division (MCQ + Essay)"**.
- Sliders / number inputs for `Essay Weight %` and `MCQ Weight %` (auto-balancing to 100%).
- Action button: **"Submit Proportion for Examiner Consensus"**.
- Triggers `POST /api/v1/requests/paper-marking/hod-proportion-division`.

---

### Flow D: Lecturer Consensus Banner (Claim Detail / Dashboard)
- When `currentStageKey === 'LECTURER_PROPORTION_CONSENSUS'`:
- Prominently display a review card for examiners:
  - **Proposed Split**: Essay ${essayWeightPercent}% / MCQ ${mcqWeightPercent}%
  - **HOD Remarks**: ${comments}
  - **Buttons**:
    - **"Agree to Proportion"** (calls `proportion-consensus` with `agreed: true`)
    - **"Disagree / Request Adjustment"** (opens feedback modal, calls `proportion-consensus` with `agreed: false` and `comments`)
- If returned to HOD due to disagreement (`status === 'DISAGREED_RETURNED_TO_HOD'`):
  - Display alert banner on HOD review screen:
    > *"Examiner ${lecturerName} disagreed with proposed split: '${comment}'. Please adjust the proportion division."*

---

## 4. TypeScript Types for Frontend

```typescript
export interface PaperStructureClaimsBreakdown {
  setting: {
    totalQuestions: number;
    claimedQuestions: number;
    remainingQuestions: number;
    isFullPaperClaimed: boolean;
    claimants: {
      examinerId: string;
      examinerName: string;
      questionsClaimed: number;
      proportion: number;
      trackingNumber: string;
      status: string;
    }[];
  };
  moderation: {
    isClaimed: boolean;
    claimedBy?: string;
  };
  typing: {
    isClaimed: boolean;
    typedPagesClaimed: number;
    claimedBy?: string;
  };
  scriptMarking: {
    totalCandidates: number;
    totalScriptsClaimed: number;
    totalQuestionsMarked: number;
    remainingQuestionsPerScript: number;
  };
}

export interface PaperStructureResponse {
  exists: boolean;
  message?: string;
  paperStructure?: {
    id: string;
    courseCode: string;
    courseTitle: string;
    academicYear: string;
    semester: string;
    examType: string;
    paperType: 'ESSAY' | 'MCQ' | 'COMBINED';
    paperDurationHours: number;
    totalQuestions: number;
    totalMcqQuestions: number;
    totalCandidates: number;
    essayWeightPercent: number;
    mcqWeightPercent: number;
    registeredByName: string;
    registeredByEmail: string;
    createdAt: string;
  };
  claimsBreakdown?: PaperStructureClaimsBreakdown;
  hodProportionDivision?: {
    essayWeightPercent: number;
    mcqWeightPercent: number;
    status: 'AWAITING_LECTURER_CONSENSUS' | 'DISAGREED_RETURNED_TO_HOD' | 'CONSENSUS_REACHED';
    setByHodName: string;
    comments?: string;
    responses: {
      lecturerId: string;
      lecturerName: string;
      agreed: boolean;
      comments?: string;
      respondedAt: string;
    }[];
  };
}
```
