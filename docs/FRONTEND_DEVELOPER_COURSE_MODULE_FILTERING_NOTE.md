# Frontend Developer Guidance: Dynamic Course Module Filtering by Semester & Department

## Overview
Course modules in the Faculty of Engineering, University of Ruhuna are now managed dynamically via the database and the Admin Portal (`/api/v1/admin/modules`). 

When a lecturer selects their **Semester** and **Department** in the claim form, the course module dropdown can query the backend with query parameters so only relevant modules for that semester and department appear.

---

## 1. Updated Form Dropdowns Endpoint

### `GET /api/v1/requests/paper-marking/options/form-dropdowns`

### Query Parameters (All Optional):
| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `semester` | `number` | `5` | Filters modules by academic semester (1–8). |
| `departmentCode` | `string` | `'EIE'` | Academic department code (`CEE`, `MME`, `EIE`, `IS`, `MENA`). |
| `departmentId` | `string (UUID)` | `'...'` | Department UUID (alternative to code). |

> **Note**: If neither `departmentCode` nor `departmentId` is provided in the query, the backend automatically uses the authenticated lecturer's primary department (`user.department`).

---

## 2. Academic Curriculum Filtering Rules

The backend applies the following Faculty of Engineering rules:

1. **Semesters 1 & 2 (Common First Year)**:
   - Students take a common engineering curriculum across civil, mechanical, electrical, computing, and interdisciplinary fields.
   - Modules from all departments (`CEE`, `MME`, `EIE`, `IS`) are offered, **excluding MENA (`MN`)**.
   - If a lecturer selects `CEE`, `EIE`, `MME`, or `IS`, their department's semester 1/2 modules plus `IS` modules are shown.

2. **Semesters 3 to 8 (Field Specialization)**:
   - **`CEE` (Civil & Environmental Engineering)**: Shows `CE` prefix modules + `IS` modules.
   - **`EIE` (Electrical & Information Engineering)**: Shows **both `EE` and `EC` (Computer Engineering)** prefix modules + `IS` modules.
   - **`MME` (Mechanical & Manufacturing Engineering)**: Shows `ME` prefix modules + `IS` modules.
   - **`MENA` (Marine Engineering & Naval Architecture)**: Shows `MN` prefix modules + `IS` modules.
   - **`IS` (Department of Interdisciplinary Studies)**: Shows `IS` prefix modules.

3. **Interdisciplinary Studies (`IS`) Common Availability**:
   - `IS` modules (Mathematics, Economics, Management, Industrial Law, etc.) are **common to all engineering departments** and are automatically included in any department's dropdown list.

---

## 3. Module Code Structure Reference

Example: `IS5302`
- **Prefix (`IS`)**: Interdisciplinary Studies
- **1st Digit (`5`)**: Semester 5
- **2nd Digit (`3`)**: 3 Credits
- **Last 2 Digits (`02`)**: Serial module number within discipline

---

## 4. Frontend React Integration Example

```typescript
// When the lecturer changes the Semester or Department in Step 2:
const fetchFilteredModules = async (semester: number, departmentCode: string) => {
  const response = await fetch(
    `/api/v1/requests/paper-marking/options/form-dropdowns?semester=${semester}&departmentCode=${departmentCode}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  // data.courseModules now contains only relevant modules!
  setCourseModuleOptions(data.courseModules);
};
```
