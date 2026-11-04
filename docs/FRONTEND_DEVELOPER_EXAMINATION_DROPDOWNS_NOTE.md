# Frontend Developer Guidance: Examination Payment Circulars, Multi-Examiner Sharing & Form Dropdowns

> **Target Release:** Faculty of Engineering — Examination & Continuous Assessment MVP  
> **Backend Integration Branch:** `feature/backend-ugc-circular-rates-and-dropdowns` (targeting `mvp`)  
> **Specification Reference:** [`docs/ENGINEERING_EXAMINATION_PAYMENT_SPECIFICATION.md`](file:///E:/Projects/UTAAS/docs/ENGINEERING_EXAMINATION_PAYMENT_SPECIFICATION.md)

---

## 1. Summary of Backend Enhancements

The backend has been upgraded to conform strictly with **UGC Circulars 981, 681, 636** and the Faculty of Engineering exam administration guidelines:

1. **Statutory Rate Updates (`GET /api/v1/requests/paper-marking/rates/circular`)**:
   - `PAPER_SETTING`: **LKR 1,200.00** (Standard 3-hour paper rate; 1hr: 400, 2hr: 800)
   - `PAPER_MODERATION`: **LKR 1,200.00**
   - `SCRIPT_MARKING`: **LKR 100.00** per script (Degree Examinations, Semesters 3–8)
   - `PAPER_TYPING`: **LKR 100.00** per page (Capped at statutory ceiling of **LKR 500.00** per paper; eligible for 1st Examiner / Setter only)
   - `CONTINUOUS_ASSESSMENT`: **LKR 25.00** per student per assessment (25% of final exam script rate under Circular 681; max 4 assessments per course)
   - `DISSERTATION_UNDERGRAD`: **LKR 600.00** per report (4-year B.Sc. Engineering FYP under Circular 981 Special Degree)
   - `DISSERTATION_POSTGRAD`: **LKR 2,000.00** per dissertation (Taught Masters)
   - `THESIS_MPHIL`: **LKR 3,000.00** / `THESIS_PHD`: **LKR 5,000.00**
   - *Translation & Scrutiny* are suppressed/set to 0 for Engineering (100% English medium).

2. **New Dropdown Options Endpoint (`GET /api/v1/requests/paper-marking/options/form-dropdowns`)**:
   - Returns curated dropdown lists for **Academic Years, Semesters, Degree Programmes, Exam Types, Examiner Roles, Paper Durations, Evaluation Types, and Course Modules** per department.
   - Eliminates manual typing errors for lecturers.

3. **Multi-Examiner Task Sharing Support (UGC Circular 981 Rule 2)**:
   - When 2 or more lecturers share setting, marking, or typing, fees are divided proportionately.
   - DTOs now accept `settingShare`, `markingShare`, `typedPageCount`, and `combinedPaperConfig`.

---

## 2. New Backend Endpoint: `GET /api/v1/requests/paper-marking/options/form-dropdowns`

**Authentication:** Bearer JWT  
**Response Contract:**
```json
{
  "academicYears": ["2024/2025", "2023/2024", "2022/2023", "2021/2022"],
  "semesters": [
    "Semester 1", "Semester 2", "Semester 3", "Semester 4",
    "Semester 5", "Semester 6", "Semester 7", "Semester 8"
  ],
  "degreeProgrammes": [
    "BScEng (Hons) in Computer Engineering",
    "BScEng (Hons) in Civil and Environmental Engineering",
    "BScEng (Hons) in Electrical and Information Engineering",
    "BScEng (Hons) in Mechanical and Manufacturing Engineering",
    "Postgraduate Diploma in Engineering",
    "Master of Science / Master of Engineering (M.Sc. / M.Eng.)",
    "Master of Philosophy (M.Phil.)",
    "Doctor of Philosophy (Ph.D.)"
  ],
  "examTypes": [
    "End Semester Examination",
    "First & Qualifying Examination",
    "Mid Semester Examination",
    "Continuous Assessment (CA)",
    "Practical / Laboratory Examination",
    "Comprehensive Design Project (CDP) / FYP",
    "Postgraduate Examination"
  ],
  "examinerRoles": [
    "First Examiner (Setter)",
    "Second Examiner (Internal)",
    "External Examiner",
    "Moderator",
    "Continuous Assessment Evaluator",
    "Supervisor / Dissertation Examiner"
  ],
  "paperDurations": [
    { "label": "1 Hour Essay Paper", "hours": 1, "rate": 400 },
    { "label": "2 Hours Essay Paper", "hours": 2, "rate": 800 },
    { "label": "3 Hours Essay Paper", "hours": 3, "rate": 1200 },
    { "label": "4 Hours Essay Paper", "hours": 4, "rate": 1600 }
  ],
  "courseModules": [
    { "code": "EC5060", "title": "Software Engineering", "departmentCode": "COM", "level": 5 },
    { "code": "EC5070", "title": "Computer Networks", "departmentCode": "COM", "level": 5 },
    { "code": "CE3010", "title": "Structural Analysis I", "departmentCode": "CIV", "level": 3 },
    { "code": "EE3010", "title": "Electric Circuit Analysis", "departmentCode": "EIE", "level": 3 },
    { "code": "ME3010", "title": "Engineering Thermodynamics", "departmentCode": "MEC", "level": 3 },
    { "code": "IS1010", "title": "Mathematics I for Engineers", "departmentCode": "ENG", "level": 1 }
  ],
  "userDepartmentCode": "COM"
}
```

---

## 3. Recommended Frontend Form UI Improvements

### A. Academic & Course Metadata (Replace Text Inputs with Dropdowns)
- **Academic Year**: Dropdown populated from `dropdowns.academicYears`.
- **Semester**: Dropdown populated from `dropdowns.semesters`.
- **Degree Programme**: Dropdown populated from `dropdowns.degreeProgrammes` (Defaults to lecturer's department program).
- **Course Module**: Searchable/filtered dropdown from `dropdowns.courseModules`. Selecting a module automatically populates `courseCode` and `courseTitle`.
- **Examination Type**: Dropdown from `dropdowns.examTypes`.
- **Examiner Role**: Dropdown from `dropdowns.examinerRoles`.

---

### B. Multi-Examiner Sharing Fields (In Payment Table / Paper Rows)

In each paper row, when multiple examiners work on the paper:

1. **Shared Paper Setting**:
   - Toggle: `[ ] Shared Setting with other lecturers?`
   - When checked:
     - Input: `Total Questions in Paper` (e.g. `5`)
     - Input: `Questions Set by You` (e.g. `2`)
     - Display helper: *Your Share: 2/5 (40%) $\rightarrow$ LKR 480.00*
   - Sends payload:
     ```json
     "settingShare": {
       "isShared": true,
       "totalQuestions": 5,
       "questionsClaimed": 2
     }
     ```

2. **Question Paper Typing (1st Examiner Only)**:
   - Checkbox: `[ ] Did you personally type this question paper?`
   - Input: `Pages Typed` (e.g. `3`)
   - Rate: LKR 100/page, automatically capped at LKR 500.
   - Sends payload: `"typedPageCount": 3`

3. **Shared Script Marking (Question-wise Split)**:
   - Toggle: `[ ] Question-wise shared marking?`
   - When checked:
     - Input: `Total Questions in Script` (e.g. `5`)
     - Input: `Questions Marked by You` (e.g. `2`)
     - Input: `Total Student Cohort Scripts` (e.g. `120`)
     - Display helper: *(2 / 5) × 120 scripts × LKR 100 = LKR 4,800.00*
   - Sends payload:
     ```json
     "markingShare": {
       "isShared": true,
       "totalQuestions": 5,
       "questionsClaimed": 2
     },
     "scriptCount": 120
     ```

4. **Continuous Assessment (CA) Section**:
   - Up to 4 assessments per course unit.
   - Fields: `Assessment Title`, `Number of Students`, `Rate: LKR 25.00/student`.

---

## 4. Backwards Compatibility
The backend remains 100% backward compatible:
- Submissions providing raw numbers in `items` or `papers` without the new sharing fields continue to calculate seamlessly.
- Server fee calculations enforce tamper-proof totals.
