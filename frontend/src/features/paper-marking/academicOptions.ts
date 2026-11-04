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
