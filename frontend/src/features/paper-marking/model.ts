/** Editable UI state, deliberately not the aggregate backend claim DTO. */
export interface PersonalInformation {
  fullName: string;
  designation: string;
  department: string;
  staffId: string;
  referenceTitle: string;
}
export interface AcademicInformation {
  academicYear: string;
  semester: string;
  degreeProgramme: string;
  courseCode: string;
  courseTitle: string;
  examType: string;
  examinerRole: string;
}
export interface PaperRow {
  id: string;
  title: string;
  durationHours: string;
  settingCount: string;
  moderationCount: string;
  translationCount: string;
  scriptCount: string;
  secondMarkingCount: string;
  assessmentUnit: 'candidates' | 'hours';
  assessmentQuantity: string;
}
export type DocumentCategory =
  'APPOINTMENT_LETTER' | 'EXAM_TIMETABLE' | 'ATTENDANCE_MARKS_SHEET';
export interface LocalDocument {
  id: string;
  file: File;
  category: DocumentCategory;
}
export const documentLabels: Record<DocumentCategory, string> = {
  APPOINTMENT_LETTER: 'Appointment letter',
  EXAM_TIMETABLE: 'Examination timetable',
  ATTENDANCE_MARKS_SHEET: 'Attendance / marks sheet',
};
export interface ClaimForm {
  personal: PersonalInformation;
  academic: AcademicInformation;
  papers: PaperRow[];
  documents: LocalDocument[];
  selectedDocumentCategory: DocumentCategory;
  declaration: boolean;
}
export interface FieldError {
  field: string;
  message: string;
  step: number;
}
export const steps = [
  { id: 'personal', label: 'Personal & Application' },
  { id: 'payment', label: 'Claim Details' },
  { id: 'documents', label: 'Supporting Documents' },
  { id: 'review', label: 'Review & Submit' },
] as const;
export const personalLabels: Record<keyof PersonalInformation, string> = {
  fullName: 'Full name',
  designation: 'Designation',
  department: 'Department',
  staffId: 'Staff ID',
  referenceTitle: 'My Reference Title',
};
export const academicLabels: Record<keyof AcademicInformation, string> = {
  academicYear: 'Academic year',
  semester: 'Semester',
  degreeProgramme: 'Degree programme',
  courseCode: 'Course code',
  courseTitle: 'Course title',
  examType: 'Examination type',
  examinerRole: 'Examiner role',
};
export function createPaper(id: string): PaperRow {
  return {
    id,
    title: '',
    durationHours: '',
    settingCount: '0',
    moderationCount: '0',
    translationCount: '0',
    scriptCount: '0',
    secondMarkingCount: '0',
    assessmentUnit: 'candidates',
    assessmentQuantity: '0',
  };
}
export function createForm(): ClaimForm {
  return {
    personal: {
      fullName: '',
      designation: '',
      department: '',
      staffId: '',
      referenceTitle: '',
    },
    academic: {
      academicYear: '',
      semester: '',
      degreeProgramme: '',
      courseCode: '',
      courseTitle: '',
      examType: '',
      examinerRole: '',
    },
    papers: [createPaper('paper-1')],
    documents: [],
    selectedDocumentCategory: 'APPOINTMENT_LETTER',
    declaration: false,
  };
}
export const persistenceUnavailable =
  'Draft saving, document upload, and submission use authenticated backend contracts. Every selected document must upload successfully before it can be attached to a saved draft or submitted claim.';
