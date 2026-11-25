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
  designations: [
    'Senior Professor',
    'Professor',
    'Associate Professor',
    'Senior Lecturer (Grade I)',
    'Senior Lecturer (Grade II)',
    'Lecturer (Unconfirmed)',
    'Lecturer (Probationary)',
  ],
  departments: [
    { code: 'CEE', name: 'Department of Civil and Environmental Engineering', label: 'CEE — Department of Civil and Environmental Engineering' },
    { code: 'EIE', name: 'Department of Electrical and Information Engineering', label: 'EIE — Department of Electrical and Information Engineering' },
    { code: 'MME', name: 'Department of Mechanical and Manufacturing Engineering', label: 'MME — Department of Mechanical and Manufacturing Engineering' },
    { code: 'MENA', name: 'Department of Marine Engineering and Naval Architecture', label: 'MENA — Department of Marine Engineering and Naval Architecture' },
    { code: 'IS', name: 'Department of Interdisciplinary Studies', label: 'IS — Department of Interdisciplinary Studies' },
  ],
  staffMembers: [
    { staffId: 'ENG/AC/0101', fullName: 'Dr. Hansana H.A.J.', email: 'lecturer@eng.ruh.ac.lk', designation: 'Senior Lecturer (Grade II)', departmentCode: 'EIE', departmentName: 'Department of Electrical and Information Engineering' },
  ],
};
