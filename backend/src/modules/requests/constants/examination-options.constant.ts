/**
 * Standardized Examination Form Dropdown Options for University of Ruhuna - Faculty of Engineering.
 * Provides curated dropdown choices for academic year, semesters, degree programmes,
 * course modules per department, exam types, examiner roles, paper durations, etc.,
 * eliminating manual text entry for academic staff.
 */

export interface CourseModuleOption {
  code: string;
  title: string;
  departmentCode: 'COM' | 'CIV' | 'EIE' | 'MEC' | 'ENG';
  level: number;
}

export const ACADEMIC_YEAR_OPTIONS = [
  '2024/2025',
  '2023/2024',
  '2022/2023',
  '2021/2022',
] as const;

export const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
] as const;

export const DEGREE_PROGRAMME_OPTIONS = [
  'BScEng (Hons) in Computer Engineering',
  'BScEng (Hons) in Civil and Environmental Engineering',
  'BScEng (Hons) in Electrical and Information Engineering',
  'BScEng (Hons) in Mechanical and Manufacturing Engineering',
  'Postgraduate Diploma in Engineering',
  'Master of Science / Master of Engineering (M.Sc. / M.Eng.)',
  'Master of Philosophy (M.Phil.)',
  'Doctor of Philosophy (Ph.D.)',
] as const;

export const EXAM_TYPE_OPTIONS = [
  'End Semester Examination',
  'First & Qualifying Examination',
  'Mid Semester Examination',
  'Continuous Assessment (CA)',
  'Practical / Laboratory Examination',
  'Comprehensive Design Project (CDP) / FYP',
  'Postgraduate Examination',
] as const;

export const EXAMINER_ROLE_OPTIONS = [
  'First Examiner (Setter)',
  'Second Examiner (Internal)',
  'External Examiner',
  'Moderator',
  'Continuous Assessment Evaluator',
  'Supervisor / Dissertation Examiner',
] as const;

export const PAPER_DURATION_OPTIONS = [
  { label: '1 Hour Essay Paper', hours: 1, rate: 400 },
  { label: '2 Hours Essay Paper', hours: 2, rate: 800 },
  { label: '3 Hours Essay Paper', hours: 3, rate: 1200 },
  { label: '4 Hours Essay Paper', hours: 4, rate: 1600 },
] as const;

export const SCRIPT_EVALUATION_TYPES = [
  { key: 'DEGREE_EXAMINATION', label: 'Degree Examination (Semesters 3-8)', rate: 100 },
  { key: 'FIRST_AND_QUALIFYING', label: 'First & Qualifying Examination (Semesters 1-2)', rate: 80 },
  { key: 'EXTERNAL_EXAMINER', label: 'External Examiner Script Evaluation', rate: 150 },
  { key: 'MCQ_PAPER', label: 'Multiple Choice Question (MCQ) Script', rate: 40 },
  { key: 'PRACTICAL_EXAM', label: 'Practical Examination Script / Candidate', rate: 100 },
  { key: 'PG_DIPLOMA', label: 'Postgraduate Diploma Script', rate: 20 },
  { key: 'PG_MASTERS', label: 'Master of Science (M.Sc.) Script', rate: 30 },
] as const;

export const DOCUMENT_CATEGORY_OPTIONS = [
  { key: 'APPOINTMENT_LETTER', label: 'Appointment Letter as Examiner' },
  { key: 'EXAM_TIMETABLE', label: 'Examination Timetable' },
  { key: 'ATTENDANCE_MARKS_SHEET', label: 'Attendance / Student Marks Sheet' },
  { key: 'HOD_COMBINED_PAPER_APPROVAL', label: 'HOD Combined Paper Approval Letter' },
  { key: 'CONTINUOUS_ASSESSMENT_SCHEDULE', label: 'Continuous Assessment Summary Schedule' },
] as const;

export const ENGINEERING_COURSE_MODULES: CourseModuleOption[] = [
  // Computer Engineering (COM)
  { code: 'EC5060', title: 'Software Engineering', departmentCode: 'COM', level: 5 },
  { code: 'EC5070', title: 'Computer Networks', departmentCode: 'COM', level: 5 },
  { code: 'EC5080', title: 'Database Systems', departmentCode: 'COM', level: 5 },
  { code: 'EC6010', title: 'Operating Systems', departmentCode: 'COM', level: 6 },
  { code: 'EC6020', title: 'Computer Architecture', departmentCode: 'COM', level: 6 },
  { code: 'EC7010', title: 'Artificial Intelligence & Machine Learning', departmentCode: 'COM', level: 7 },
  { code: 'EC7020', title: 'Distributed Systems & Cloud Computing', departmentCode: 'COM', level: 7 },
  { code: 'EC8010', title: 'Cybersecurity & Cryptography', departmentCode: 'COM', level: 8 },

  // Civil & Environmental Engineering (CIV)
  { code: 'CE3010', title: 'Structural Analysis I', departmentCode: 'CIV', level: 3 },
  { code: 'CE3020', title: 'Fluid Mechanics', departmentCode: 'CIV', level: 3 },
  { code: 'CE4010', title: 'Soil Mechanics & Geotechnical Engineering', departmentCode: 'CIV', level: 4 },
  { code: 'CE5010', title: 'Transportation Engineering', departmentCode: 'CIV', level: 5 },
  { code: 'CE5020', title: 'Environmental Engineering', departmentCode: 'CIV', level: 5 },
  { code: 'CE6010', title: 'Reinforced Concrete Design', departmentCode: 'CIV', level: 6 },
  { code: 'CE7010', title: 'Hydraulic Engineering & Water Resources', departmentCode: 'CIV', level: 7 },

  // Electrical & Information Engineering (EIE)
  { code: 'EE3010', title: 'Electric Circuit Analysis', departmentCode: 'EIE', level: 3 },
  { code: 'EE3020', title: 'Analog Electronics', departmentCode: 'EIE', level: 3 },
  { code: 'EE4010', title: 'Signals and Systems', departmentCode: 'EIE', level: 4 },
  { code: 'EE5010', title: 'Power Systems Engineering', departmentCode: 'EIE', level: 5 },
  { code: 'EE5020', title: 'Control Systems Engineering', departmentCode: 'EIE', level: 5 },
  { code: 'EE6010', title: 'Digital Signal Processing', departmentCode: 'EIE', level: 6 },
  { code: 'EE7010', title: 'High Voltage Engineering', departmentCode: 'EIE', level: 7 },

  // Mechanical & Manufacturing Engineering (MEC)
  { code: 'ME3010', title: 'Engineering Thermodynamics', departmentCode: 'MEC', level: 3 },
  { code: 'ME3020', title: 'Mechanics of Materials', departmentCode: 'MEC', level: 3 },
  { code: 'ME4010', title: 'Manufacturing Technology', departmentCode: 'MEC', level: 4 },
  { code: 'ME5010', title: 'Theory of Machines', departmentCode: 'MEC', level: 5 },
  { code: 'ME5020', title: 'Applied Fluid Dynamics', departmentCode: 'MEC', level: 5 },
  { code: 'ME6010', title: 'Heat & Mass Transfer', departmentCode: 'MEC', level: 6 },
  { code: 'ME7010', title: 'Automobile Engineering & Mechatronics', departmentCode: 'MEC', level: 7 },

  // Common Engineering / Interdisciplinary (ENG)
  { code: 'IS1010', title: 'Mathematics I for Engineers', departmentCode: 'ENG', level: 1 },
  { code: 'IS1020', title: 'Engineering Mechanics', departmentCode: 'ENG', level: 1 },
  { code: 'IS2010', title: 'Mathematics II - Linear Algebra & Calculus', departmentCode: 'ENG', level: 2 },
  { code: 'IS2020', title: 'Numerical Methods for Engineering', departmentCode: 'ENG', level: 2 },
];

export const DESIGNATION_OPTIONS = [
  'Senior Professor',
  'Professor',
  'Associate Professor',
  'Senior Lecturer (Grade I)',
  'Senior Lecturer (Grade II)',
  'Lecturer (Unconfirmed)',
  'Lecturer (Probationary)',
  'Temporary Lecturer',
  'Visiting Lecturer',
] as const;

export interface DepartmentOption {
  code: string;
  name: string;
  label: string;
}

export const FACULTY_DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { code: 'CEE', name: 'Department of Civil and Environmental Engineering', label: 'CEE — Department of Civil and Environmental Engineering' },
  { code: 'EIE', name: 'Department of Electrical and Information Engineering', label: 'EIE — Department of Electrical and Information Engineering' },
  { code: 'MME', name: 'Department of Mechanical and Manufacturing Engineering', label: 'MME — Department of Mechanical and Manufacturing Engineering' },
  { code: 'MENA', name: 'Department of Marine Engineering and Naval Architecture', label: 'MENA — Department of Marine Engineering and Naval Architecture' },
  { code: 'IS', name: 'Department of Interdisciplinary Studies', label: 'IS — Department of Interdisciplinary Studies' },
];

export interface StaffDirectoryOption {
  staffId: string;
  fullName: string;
  email: string;
  designation: string;
  departmentCode: string;
  departmentName: string;
}

export const STAFF_DIRECTORY_OPTIONS: StaffDirectoryOption[] = [
  {
    staffId: 'ENG/AC/0101',
    fullName: 'Dr. Hansana H.A.J.',
    email: 'lecturer@eng.ruh.ac.lk',
    designation: 'Senior Lecturer (Grade II)',
    departmentCode: 'EIE',
    departmentName: 'Department of Electrical and Information Engineering',
  },
  {
    staffId: 'ENG/AC/0102',
    fullName: 'Prof. K.U. Herath',
    email: 'hod.computer@eng.ruh.ac.lk',
    designation: 'Professor',
    departmentCode: 'EIE',
    departmentName: 'Department of Electrical and Information Engineering',
  },
  {
    staffId: 'ENG/AC/0201',
    fullName: 'Prof. D.M. Silva',
    email: 'hod.civil@eng.ruh.ac.lk',
    designation: 'Professor',
    departmentCode: 'CEE',
    departmentName: 'Department of Civil and Environmental Engineering',
  },
  {
    staffId: 'ENG/AC/0301',
    fullName: 'Dr. P.S. Ranawaka',
    email: 'dean@eng.ruh.ac.lk',
    designation: 'Associate Professor',
    departmentCode: 'MME',
    departmentName: 'Department of Mechanical and Manufacturing Engineering',
  },
  {
    staffId: 'ENG/AC/0401',
    fullName: 'Dr. T.M. Jayawardena',
    email: 'mena.staff@eng.ruh.ac.lk',
    designation: 'Senior Lecturer (Grade I)',
    departmentCode: 'MENA',
    departmentName: 'Department of Marine Engineering and Naval Architecture',
  },
  {
    staffId: 'ENG/AC/0501',
    fullName: 'Dr. N.K. Wickramasinghe',
    email: 'is.staff@eng.ruh.ac.lk',
    designation: 'Senior Lecturer (Grade I)',
    departmentCode: 'IS',
    departmentName: 'Department of Interdisciplinary Studies',
  },
  {
    staffId: 'ENG/AC/0103',
    fullName: 'Dr. S.B. Wijekoon',
    email: 'wijekoon@eng.ruh.ac.lk',
    designation: 'Lecturer (Probationary)',
    departmentCode: 'EIE',
    departmentName: 'Department of Electrical and Information Engineering',
  },
  {
    staffId: 'ENG/AC/0202',
    fullName: 'Dr. R.M. Pathirana',
    email: 'pathirana@eng.ruh.ac.lk',
    designation: 'Senior Lecturer (Grade II)',
    departmentCode: 'CEE',
    departmentName: 'Department of Civil and Environmental Engineering',
  },
];

export const QUANTITY_PRESETS = {
  paperSetting: ['0', '1', '2', '3', '4', '5'],
  paperModeration: ['0', '1', '2', '3', '4'],
  paperTranslation: ['0', '1', '2', '3'],
  scriptsMarked: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200'],
  secondMarking: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200'],
  assessmentCandidates: ['0', '10', '20', '30', '40', '50', '60', '75', '80', '100', '120', '150', '200', '250', '300'],
};
