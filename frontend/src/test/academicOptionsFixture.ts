// Fictional API fixtures used only by tests; never imported by application code.
export const academicOptionsFixture = {
  academicYears: ['2024/2025', '2023/2024', '2026', '2025/26'],
  semesters: ['Semester 1', 'Semester 5', 'Semester 6', '1'],
  degreeProgrammes: ['BSc', 'BSc Engineering', 'Postgraduate Engineering'],
  examTypes: ['Final', 'End Semester Examination'],
  examinerRoles: ['First Examiner', 'Chief Examiner'],
  paperDurations: [
    { label: '1 Hour Essay Paper', hours: 1, rate: 400 },
    { label: '2 Hours Essay Paper', hours: 2, rate: 800 },
    { label: '3 Hours Essay Paper', hours: 3, rate: 1200 },
  ],
  courseModules: [
    {
      code: 'EC5060',
      title: 'Software Engineering',
      departmentCode: 'ENG',
      semester: 5,
      credits: 3,
    },
    {
      code: 'EC5070',
      title: 'Computer Networks',
      departmentCode: 'ENG',
      semester: 5,
      credits: 3,
    },
    {
      code: 'EC6010',
      title: 'Operating Systems',
      departmentCode: 'ENG',
      semester: 6,
      credits: 3,
    },
  ],
  userDepartmentCode: 'ENG',
};
