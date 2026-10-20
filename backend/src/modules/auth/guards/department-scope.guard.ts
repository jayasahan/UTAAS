import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../database/entities/user.entity';

@Injectable()
export class DepartmentScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is required for department-scoped operations');
    }

    // Faculty-wide roles bypass individual department boundary restrictions
    const facultyWideRoles = [
      UserRole.DEAN,
      UserRole.EXAMINATION_OFFICER,
      UserRole.FINANCIAL_OFFICER,
      UserRole.ASSISTANT_BURSAR,
      UserRole.ADMIN,
    ];

    if (facultyWideRoles.includes(user.role)) {
      return true;
    }

    // Extract target department identifier from params, body, or query
    const targetDepartmentId =
      request.params?.departmentId ||
      request.body?.departmentId ||
      request.query?.departmentId;

    const targetDepartmentCode =
      request.params?.departmentCode ||
      request.body?.departmentCode ||
      request.query?.departmentCode;

    // If no department is explicitly targeted in the request, allow through (downstream services enforce row-level ownership)
    if (!targetDepartmentId && !targetDepartmentCode) {
      return true;
    }

    // For HOD and LECTURER, strictly enforce department match
    const userDeptId = user.departmentId || user.department?.id;
    const userDeptCode = user.department?.code;

    const idMatches = targetDepartmentId && userDeptId && targetDepartmentId === userDeptId;
    const codeMatches =
      targetDepartmentCode &&
      userDeptCode &&
      targetDepartmentCode.toUpperCase() === userDeptCode.toUpperCase();

    if (idMatches || codeMatches) {
      return true;
    }

    throw new ForbiddenException(
      `Department boundary violation: User from department '${userDeptCode || userDeptId}' cannot access resources belonging to department '${targetDepartmentCode || targetDepartmentId}'`,
    );
  }
}
