import { record, text } from '../../auth/contracts';
import type { ClaimForm, FieldError } from './model';

export interface PaperDurationOption {
  label: string;
  hours: number;
  rate: number;
}

export interface CourseModuleOption {
  code: string;
  title: string;
  departmentCode: string;
  semester: number;
}

export interface DepartmentOption {
  code: string;
  name: string;
  label: string;
}

export interface StaffDirectoryOption {
  staffId: string;
  fullName: string;
  email: string;
  designation: string;
  departmentCode: string;
  departmentName: string;
}

export interface QuantityPresets {
  paperSetting: string[];
  paperModeration: string[];
  paperTranslation: string[];
  scriptsMarked: string[];
  secondMarking: string[];
  assessmentCandidates: string[];
}

export const DEFAULT_DESIGNATIONS = [
  'Senior Professor',
  'Professor',
  'Associate Professor',
  'Senior Lecturer (Grade I)',
  'Senior Lecturer (Grade II)',
  'Lecturer (Unconfirmed)',
  'Lecturer (Probationary)',
  'Temporary Lecturer',
  'Visiting Lecturer',
];

export const DEFAULT_DEPARTMENTS: DepartmentOption[] = [
  { code: 'CEE', name: 'Department of Civil and Environmental Engineering', label: 'CEE — Department of Civil and Environmental Engineering' },
  { code: 'EIE', name: 'Department of Electrical and Information Engineering', label: 'EIE — Department of Electrical and Information Engineering' },
  { code: 'MME', name: 'Department of Mechanical and Manufacturing Engineering', label: 'MME — Department of Mechanical and Manufacturing Engineering' },
  { code: 'MENA', name: 'Department of Marine Engineering and Naval Architecture', label: 'MENA — Department of Marine Engineering and Naval Architecture' },
  { code: 'IS', name: 'Department of Interdisciplinary Studies', label: 'IS — Department of Interdisciplinary Studies' },
];

export const DEFAULT_STAFF_MEMBERS: StaffDirectoryOption[] = [
  { staffId: 'ENG/AC/0101', fullName: 'Dr. Hansana H.A.J.', email: 'lecturer@eng.ruh.ac.lk', designation: 'Senior Lecturer (Grade II)', departmentCode: 'EIE', departmentName: 'Department of Electrical and Information Engineering' },
  { staffId: 'ENG/AC/0102', fullName: 'Prof. K.U. Herath', email: 'hod.computer@eng.ruh.ac.lk', designation: 'Professor', departmentCode: 'EIE', departmentName: 'Department of Electrical and Information Engineering' },
  { staffId: 'ENG/AC/0201', fullName: 'Prof. D.M. Silva', email: 'hod.civil@eng.ruh.ac.lk', designation: 'Professor', departmentCode: 'CEE', departmentName: 'Department of Civil and Environmental Engineering' },
  { staffId: 'ENG/AC/0301', fullName: 'Dr. P.S. Ranawaka', email: 'dean@eng.ruh.ac.lk', designation: 'Associate Professor', departmentCode: 'MME', departmentName: 'Department of Mechanical and Manufacturing Engineering' },
  { staffId: 'ENG/AC/0401', fullName: 'Dr. T.M. Jayawardena', email: 'mena.staff@eng.ruh.ac.lk', designation: 'Senior Lecturer (Grade I)', departmentCode: 'MENA', departmentName: 'Department of Marine Engineering and Naval Architecture' },
  { staffId: 'ENG/AC/0501', fullName: 'Dr. N.K. Wickramasinghe', email: 'is.staff@eng.ruh.ac.lk', designation: 'Senior Lecturer (Grade I)', departmentCode: 'IS', departmentName: 'Department of Interdisciplinary Studies' },
  { staffId: 'ENG/AC/0103', fullName: 'Dr. S.B. Wijekoon', email: 'wijekoon@eng.ruh.ac.lk', designation: 'Lecturer (Probationary)', departmentCode: 'EIE', departmentName: 'Department of Electrical and Information Engineering' },
  { staffId: 'ENG/AC/0202', fullName: 'Dr. R.M. Pathirana', email: 'pathirana@eng.ruh.ac.lk', designation: 'Senior Lecturer (Grade II)', departmentCode: 'CEE', departmentName: 'Department of Civil and Environmental Engineering' },
];

export const DEFAULT_QUANTITY_PRESETS: QuantityPresets = {
  paperSetting: ['0', '1', '2', '3', '4', '5'],
  paperModeration: ['0', '1', '2', '3', '4'],
  paperTranslation: ['0', '1', '2', '3'],
  scriptsMarked: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200'],
  secondMarking: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200'],
  assessmentCandidates: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200', '250', '300'],
};

export interface AcademicOptions {
  academicYears: string[];
  semesters: string[];
  degreeProgrammes: string[];
  examTypes: string[];
  examinerRoles: string[];
  paperDurations: PaperDurationOption[];
  courseModules: CourseModuleOption[];
  coursesVerified: boolean;
  userDepartmentCode: string | null;
  designations: string[];
  departments: DepartmentOption[];
  staffMembers: StaffDirectoryOption[];
  quantityPresets: QuantityPresets;
}

function choices(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid dropdown choices');
  const entries = value.map((entry) => text(entry));
  if (new Set(entries).size !== entries.length)
    throw new Error('Duplicate dropdown choices');
  return entries;
}

function positiveNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw new Error('Invalid dropdown number');
  return value;
}

export function semesterNumber(value: string): number | null {
  const match = /^(?:Semester\s+)?([1-8])$/i.exec(value.trim());
  return match?.[1] ? Number(match[1]) : null;
}

/** Decode only consumed fields. Rates are reference data, not a fee calculation. */
export function decodeAcademicOptions(value: unknown): AcademicOptions {
  const data = record(value);
  if (!Array.isArray(data.paperDurations) || !Array.isArray(data.courseModules))
    throw new Error('Invalid dropdown response');
  const paperDurations = data.paperDurations.map((value) => {
    const duration = record(value);
    if (
      typeof duration.rate !== 'number' ||
      !Number.isFinite(duration.rate) ||
      duration.rate < 0
    )
      throw new Error('Invalid duration rate');
    return {
      label: text(duration.label),
      hours: positiveNumber(duration.hours),
      rate: duration.rate,
    };
  });
  if (
    new Set(paperDurations.map((entry) => entry.hours)).size !==
    paperDurations.length
  )
    throw new Error('Ambiguous paper durations');

  let coursesVerified = true;
  const courseModules = data.courseModules.map((value) => {
    const course = record(value);
    // The controller silently returns its unfiltered legacy constants on empty
    // results/errors. Their `level` shape must not become selectable scoped data.
    if (course.semester === undefined && course.level !== undefined)
      coursesVerified = false;
    const semester = course.semester ?? course.level;
    if (
      typeof semester !== 'number' ||
      !Number.isInteger(semester) ||
      semester < 1 ||
      semester > 8
    )
      throw new Error('Invalid course semester');
    return {
      code: text(course.code),
      title: text(course.title),
      departmentCode: text(course.departmentCode),
      semester,
    };
  });
  if (
    new Set(courseModules.map((entry) => entry.code)).size !==
    courseModules.length
  )
    throw new Error('Ambiguous course codes');
  const designations = Array.isArray(data.designations)
    ? choices(data.designations)
    : DEFAULT_DESIGNATIONS;

  const departments = Array.isArray(data.departments)
    ? data.departments.map((deptVal) => {
        const d = record(deptVal);
        return {
          code: text(d.code),
          name: text(d.name),
          label: text(d.label ?? `${d.code} — ${d.name}`),
        };
      })
    : DEFAULT_DEPARTMENTS;

  const staffMembers = Array.isArray(data.staffMembers)
    ? data.staffMembers.map((staffVal) => {
        const s = record(staffVal);
        return {
          staffId: text(s.staffId),
          fullName: text(s.fullName),
          email: text(s.email),
          designation: text(s.designation),
          departmentCode: text(s.departmentCode),
          departmentName: text(s.departmentName),
        };
      })
    : DEFAULT_STAFF_MEMBERS;

  const rawPresets =
    data.quantityPresets && typeof data.quantityPresets === 'object'
      ? record(data.quantityPresets)
      : null;

  const quantityPresets = rawPresets
    ? {
        paperSetting: Array.isArray(rawPresets.paperSetting)
          ? choices(rawPresets.paperSetting)
          : DEFAULT_QUANTITY_PRESETS.paperSetting,
        paperModeration: Array.isArray(rawPresets.paperModeration)
          ? choices(rawPresets.paperModeration)
          : DEFAULT_QUANTITY_PRESETS.paperModeration,
        paperTranslation: Array.isArray(rawPresets.paperTranslation)
          ? choices(rawPresets.paperTranslation)
          : DEFAULT_QUANTITY_PRESETS.paperTranslation,
        scriptsMarked: Array.isArray(rawPresets.scriptsMarked)
          ? choices(rawPresets.scriptsMarked)
          : DEFAULT_QUANTITY_PRESETS.scriptsMarked,
        secondMarking: Array.isArray(rawPresets.secondMarking)
          ? choices(rawPresets.secondMarking)
          : DEFAULT_QUANTITY_PRESETS.secondMarking,
        assessmentCandidates: Array.isArray(rawPresets.assessmentCandidates)
          ? choices(rawPresets.assessmentCandidates)
          : DEFAULT_QUANTITY_PRESETS.assessmentCandidates,
      }
    : DEFAULT_QUANTITY_PRESETS;

  return {
    academicYears: choices(data.academicYears),
    semesters: choices(data.semesters),
    degreeProgrammes: choices(data.degreeProgrammes),
    examTypes: choices(data.examTypes),
    examinerRoles: choices(data.examinerRoles),
    paperDurations,
    courseModules,
    coursesVerified,
    userDepartmentCode:
      data.userDepartmentCode == null ? null : text(data.userDepartmentCode),
    designations,
    departments,
    staffMembers,
    quantityPresets,
  };
}

export interface AcademicChoices {
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  data: AcademicOptions | null;
  courses: CourseModuleOption[];
  courseMessage: string;
}

/** Saving partial drafts remains possible; advancing/submitting needs current choices. */
export function validateAcademicChoices(
  form: ClaimForm,
  choices: AcademicChoices,
): FieldError[] {
  if (choices.status !== 'ready' || !choices.data)
    return [
      {
        field: 'academic-options',
        step: 1,
        message:
          'Load the academic choices before continuing. Your current values are preserved.',
      },
    ];
  const errors: FieldError[] = [];
  const add = (field: string, message: string) =>
    errors.push({ field, message, step: 1 });
  const fields = {
    academicYear: choices.data.academicYears,
    semester: choices.data.semesters,
    degreeProgramme: choices.data.degreeProgrammes,
    examType: choices.data.examTypes,
    examinerRole: choices.data.examinerRoles,
  };
  for (const [field, options] of Object.entries(fields) as [
    keyof typeof fields,
    string[],
  ][])
    if (form.academic[field].trim() && !options.includes(form.academic[field]))
      add(field, 'Choose a value from the current academic choices.');
  const course = choices.courses.find(
    (entry) => entry.code === form.academic.courseCode,
  );
  if (choices.courseMessage && form.academic.courseCode.trim())
    add('courseCode', choices.courseMessage);
  else if (form.academic.courseCode.trim() && !course)
    add(
      'courseCode',
      'Choose a course available for your department and semester.',
    );
  if (
    course &&
    form.academic.courseTitle.trim() &&
    form.academic.courseTitle !== course.title
  )
    add('courseTitle', 'Select the course again to use its current title.');
  for (const paper of form.papers)
    if (
      /^\d+(?:\.\d+)?$/.test(paper.durationHours) &&
      Number(paper.durationHours) > 0 &&
      !choices.data.paperDurations.some(
        (entry) => entry.hours === Number(paper.durationHours),
      )
    )
      add(
        `${paper.id}-durationHours`,
        'Choose an examination duration from the current choices.',
      );
  return errors;
}
