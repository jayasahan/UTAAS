import { describe, expect, it } from 'vitest';
import { academicOptionsFixture } from '../../test/academicOptionsFixture';
import { createForm } from './model';
import {
  decodeAcademicOptions,
  semesterNumber,
  validateAcademicChoices,
} from './academicOptions';

describe('academic dropdown contracts', () => {
  it('decodes database-backed choices without supplying defaults', () => {
    const options = decodeAcademicOptions(academicOptionsFixture);
    expect(options.courseModules[0]).toMatchObject({
      code: 'EC5060',
      semester: 5,
    });
    expect(options.coursesVerified).toBe(true);
    expect(options.designations.length).toBeGreaterThan(0);
    expect(options.departments.length).toBeGreaterThan(0);
    expect(options.staffMembers.length).toBeGreaterThan(0);
    expect(options.quantityPresets.paperSetting).toContain('1');
    expect(options.quantityPresets.scriptsMarked).toContain('50');
    expect(
      decodeAcademicOptions({
        ...academicOptionsFixture,
        courseModules: [],
        academicYears: [],
      }).academicYears,
    ).toEqual([]);
  });

  it('recognizes the unfiltered legacy shape instead of offering it as scoped courses', () => {
    const options = decodeAcademicOptions({
      ...academicOptionsFixture,
      courseModules: [
        {
          code: 'EC5060',
          title: 'Legacy title',
          departmentCode: 'COM',
          level: 5,
        },
      ],
    });
    expect(options.coursesVerified).toBe(false);
  });

  it.each([
    { academicYears: 'not an array' },
    { semesters: ['Semester 5', 'Semester 5'] },
    { paperDurations: [{ hours: 3, label: 'Three hours', rate: -1 }] },
    { paperDurations: [{ hours: NaN, label: 'Three hours', rate: 1200 }] },
    {
      courseModules: [
        { code: 'EC5060', title: '', semester: 5, departmentCode: 'ENG' },
      ],
    },
    {
      courseModules: [
        { code: 'EC5060', title: 'Course', semester: 9, departmentCode: 'ENG' },
      ],
    },
    {
      courseModules: [
        academicOptionsFixture.courseModules[0],
        academicOptionsFixture.courseModules[0],
      ],
    },
  ])('rejects malformed or ambiguous choices: %j', (overrides) => {
    expect(() =>
      decodeAcademicOptions({ ...academicOptionsFixture, ...overrides }),
    ).toThrow();
  });

  it('maps semester labels to query numbers without changing their saved representation', () => {
    expect(semesterNumber('Semester 5')).toBe(5);
    expect(semesterNumber('1')).toBe(1);
    expect(semesterNumber('Semester 9')).toBeNull();
    expect(semesterNumber('')).toBeNull();
  });

  it('rejects unavailable selections and mismatched titles without overwriting the draft', () => {
    const form = createForm();
    form.academic = {
      academicYear: '2024/2025',
      semester: 'Semester 5',
      degreeProgramme: 'BSc',
      courseCode: 'EC5060',
      courseTitle: 'Older title',
      examType: 'Final',
      examinerRole: 'First Examiner',
    };
    form.papers[0]!.durationHours = '9';
    const before = structuredClone(form);
    const data = decodeAcademicOptions(academicOptionsFixture);
    const errors = validateAcademicChoices(form, {
      status: 'ready',
      data,
      courses: data.courseModules,
      courseMessage: '',
    });
    expect(errors.map((error) => error.field)).toEqual([
      'courseTitle',
      'paper-1-durationHours',
    ]);
    expect(form).toEqual(before);
    expect(
      validateAcademicChoices(form, {
        status: 'loading',
        data: null,
        courses: [],
        courseMessage: '',
      })[0]?.field,
    ).toBe('academic-options');
  });
});
