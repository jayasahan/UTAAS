import {
  Department,
  User,
  UserRole,
  RequestType,
  WorkflowTemplate,
  Request,
  RequestStatus,
  RequestStageHistory,
  StageAction,
  AuditEvent,
} from './index';

describe('Database Entities Unit Tests', () => {
  describe('Department & User Entities', () => {
    it('should create department entity correctly', () => {
      const dept = new Department();
      dept.code = 'COM';
      dept.name = 'Department of Computer Engineering';

      expect(dept.code).toBe('COM');
      expect(dept.name).toBe('Department of Computer Engineering');
    });

    it('should create user with valid role and department reference', () => {
      const user = new User();
      user.email = 'lecturer@eng.ruh.ac.lk';
      user.fullName = 'Dr. Hansana H.A.J.';
      user.role = UserRole.LECTURER;

      expect(user.role).toBe(UserRole.LECTURER);
      expect(user.email).toBe('lecturer@eng.ruh.ac.lk');
    });

    it('should support all university actor roles', () => {
      expect(UserRole.LECTURER).toBe('LECTURER');
      expect(UserRole.HOD).toBe('HOD');
      expect(UserRole.DEAN).toBe('DEAN');
      expect(UserRole.EXAMINATION_OFFICER).toBe('EXAMINATION_OFFICER');
      expect(UserRole.FINANCIAL_OFFICER).toBe('FINANCIAL_OFFICER');
      expect(UserRole.ASSISTANT_BURSAR).toBe('ASSISTANT_BURSAR');
      expect(UserRole.ADMIN).toBe('ADMIN');
    });
  });

  describe('WorkflowTemplate & RequestType', () => {
    it('should configure 6-stage Paper Setting & Marking workflow', () => {
      const template = new WorkflowTemplate();
      template.version = 1;
      template.stages = [
        { order: 0, stageKey: 'SUBMISSION', stageName: 'Lecturer Submission', requiredRole: UserRole.LECTURER },
        { order: 1, stageKey: 'HEAD_OF_DEPARTMENT', stageName: 'HOD Recommendation', requiredRole: UserRole.HOD, isDepartmentScoped: true },
        { order: 2, stageKey: 'DEAN', stageName: 'Dean Faculty Approval', requiredRole: UserRole.DEAN },
        { order: 3, stageKey: 'EXAMINATION_OFFICE', stageName: 'Exam Office Verification', requiredRole: UserRole.EXAMINATION_OFFICER },
        { order: 4, stageKey: 'FINANCIAL_OFFICE', stageName: 'Financial Office Certification', requiredRole: UserRole.FINANCIAL_OFFICER },
        { order: 5, stageKey: 'ASSISTANT_BURSAR', stageName: 'Assistant Bursar Settlement', requiredRole: UserRole.ASSISTANT_BURSAR },
      ];

      expect(template.stages).toHaveLength(6);
      expect(template.stages[1].requiredRole).toBe(UserRole.HOD);
      expect(template.stages[1].isDepartmentScoped).toBe(true);
      expect(template.stages[3].stageKey).toBe('EXAMINATION_OFFICE');
      expect(template.stages[5].requiredRole).toBe(UserRole.ASSISTANT_BURSAR);
    });
  });

  describe('Request & Stage History', () => {
    it('should initialize Request with DRAFT status and tracking number', () => {
      const req = new Request();
      req.trackingNumber = 'UTR-2026-0001';
      req.status = RequestStatus.DRAFT;
      req.totalAmount = 18050.0;
      req.formData = {
        courseCode: 'EC 5406',
        courseTitle: 'Software Engineering Project',
        claimItems: { paperSetting: { count: 1, rate: 3500 } },
      };

      expect(req.trackingNumber).toBe('UTR-2026-0001');
      expect(req.status).toBe(RequestStatus.DRAFT);
      expect(req.totalAmount).toBe(18050.0);
      expect(req.formData.courseCode).toBe('EC 5406');
    });

    it('should support stage history with transition actions', () => {
      const history = new RequestStageHistory();
      history.stageKey = 'EXAMINATION_OFFICE';
      history.stageName = 'Examination Office Checking';
      history.requiredRole = UserRole.EXAMINATION_OFFICER;
      history.stageOrder = 3;
      history.action = StageAction.APPROVED;
      history.comments = 'Candidate counts and appointment letter verified.';

      expect(history.action).toBe(StageAction.APPROVED);
      expect(history.requiredRole).toBe(UserRole.EXAMINATION_OFFICER);
      expect(history.stageOrder).toBe(3);
    });
  });

  describe('AuditEvent Entity', () => {
    it('should create an audit event record with before/after state diff', () => {
      const event = new AuditEvent();
      event.requestId = 'req-123';
      event.actorName = 'Prof. K.U. Herath';
      event.actorRole = 'HOD';
      event.actionType = 'APPROVE';
      event.previousStatus = 'SUBMITTED';
      event.newStatus = 'UNDER_REVIEW';
      event.fieldDiff = { totalAmount: { from: 18050.0, to: 18050.0 } };
      event.comment = 'Recommended for Dean review.';

      expect(event.actorName).toBe('Prof. K.U. Herath');
      expect(event.actionType).toBe('APPROVE');
      expect(event.previousStatus).toBe('SUBMITTED');
      expect(event.newStatus).toBe('UNDER_REVIEW');
    });
  });
});
