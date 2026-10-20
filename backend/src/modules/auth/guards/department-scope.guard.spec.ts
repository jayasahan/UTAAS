import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DepartmentScopeGuard } from './department-scope.guard';
import { UserRole } from '../../../database/entities/user.entity';

describe('DepartmentScopeGuard', () => {
  let guard: DepartmentScopeGuard;

  beforeEach(() => {
    guard = new DepartmentScopeGuard();
  });

  function createMockContext(user: any, params: any = {}, body: any = {}, query: any = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params, body, query }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow faculty-wide roles (DEAN, EXAM_OFFICER, etc.) to access any department', () => {
    const deanContext = createMockContext(
      { role: UserRole.DEAN },
      { departmentCode: 'COM' },
    );
    expect(guard.canActivate(deanContext)).toBe(true);

    const examContext = createMockContext(
      { role: UserRole.EXAMINATION_OFFICER },
      { departmentId: 'dept-civ-123' },
    );
    expect(guard.canActivate(examContext)).toBe(true);
  });

  it('should allow HOD when target departmentCode matches user department code', () => {
    const hodUser = {
      role: UserRole.HOD,
      departmentId: 'dept-com-1',
      department: { id: 'dept-com-1', code: 'COM' },
    };
    const context = createMockContext(hodUser, { departmentCode: 'COM' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow HOD when target departmentId matches user departmentId', () => {
    const hodUser = {
      role: UserRole.HOD,
      departmentId: 'dept-com-1',
      department: { id: 'dept-com-1', code: 'COM' },
    };
    const context = createMockContext(hodUser, {}, { departmentId: 'dept-com-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when HOD tries to access another department', () => {
    const hodUser = {
      role: UserRole.HOD,
      departmentId: 'dept-com-1',
      department: { id: 'dept-com-1', code: 'COM' },
    };
    const context = createMockContext(hodUser, { departmentCode: 'CIV' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow through if no target department is specified in request', () => {
    const hodUser = {
      role: UserRole.HOD,
      departmentId: 'dept-com-1',
      department: { id: 'dept-com-1', code: 'COM' },
    };
    const context = createMockContext(hodUser, {}, {}, {});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is missing from request', () => {
    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
