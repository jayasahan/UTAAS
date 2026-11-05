import type { StaffProfile } from '../auth/contracts';
import type { RequestDetail } from '../features/requests/contracts';
import type { ConsensusResponse } from '../features/requests/workflowTracking';

/** Synthetic test data only. No production component imports this module. */
export function consensusFixture() {
  const exam = {
    courseCode: 'EC5060',
    academicYear: '2026',
    semester: '1',
    examType: 'Final',
  };
  const viewer: StaffProfile = {
    id: 'lecturer-me',
    fullName: 'Lecturer Name',
    email: 'lecturer@example.test',
    role: 'LECTURER',
    departmentCode: 'ENG',
    departmentId: 'dept-1',
  };
  const proposal = {
    status: 'AWAITING_LECTURER_CONSENSUS',
    essayWeightPercent: 60,
    mcqWeightPercent: 40,
    comments: 'HOD proposal remarks',
    setByHodName: 'Recorded HOD',
    setAt: '2026-11-01T09:00:00.000Z',
    responses: [] as ConsensusResponse[],
  };
  const detail: RequestDetail = {
    id: 'b6a51b21-71e2-47d0-b5cb-965b8c4af922',
    trackingNumber: 'UT-CONSENSUS',
    status: 'UNDER_REVIEW',
    currentStageKey: 'LECTURER_PROPORTION_CONSENSUS',
    createdAt: '2026-11-01T08:00:00.000Z',
    totalAmount: 2345.67,
    formData: {
      metadata: {
        ...exam,
        courseTitle: 'Software Engineering',
        degreeProgramme: 'BSc',
        examinerRole: 'First Examiner',
      },
      hodProportionDivision: structuredClone(proposal),
    },
  };
  const structure = {
    id: 'structure-1',
    ...exam,
    hodProportionDivision: proposal,
  };
  return { exam, viewer, detail, structure };
}
