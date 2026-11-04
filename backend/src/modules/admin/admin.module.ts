import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { Request } from '../../database/entities/request.entity';
import { WorkflowTemplate } from '../../database/entities/workflow-template.entity';
import { RequestType } from '../../database/entities/request-type.entity';
import { AuditEvent } from '../../database/entities/audit-event.entity';
import { CourseModule } from '../../database/entities/course-module.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminDepartmentsController } from './controllers/admin-departments.controller';
import { AdminDepartmentsService } from './services/admin-departments.service';
import { AdminWorkflowsController } from './controllers/admin-workflows.controller';
import { AdminWorkflowsService } from './services/admin-workflows.service';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminModulesController } from './controllers/admin-modules.controller';
import { AdminModulesService } from './services/admin-modules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Department,
      Request,
      WorkflowTemplate,
      RequestType,
      AuditEvent,
      CourseModule,
    ]),
  ],
  controllers: [
    AdminUsersController,
    AdminDepartmentsController,
    AdminWorkflowsController,
    AdminAuditController,
    AdminDashboardController,
    AdminModulesController,
  ],
  providers: [
    AdminUsersService,
    AdminDepartmentsService,
    AdminWorkflowsService,
    AdminAuditService,
    AdminDashboardService,
    AdminModulesService,
  ],
  exports: [
    AdminUsersService,
    AdminDepartmentsService,
    AdminWorkflowsService,
    AdminAuditService,
    AdminDashboardService,
    AdminModulesService,
  ],
})
export class AdminModule {}
