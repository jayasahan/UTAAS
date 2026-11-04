import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { Request } from '../../database/entities/request.entity';
import { WorkflowTemplate } from '../../database/entities/workflow-template.entity';
import { RequestType } from '../../database/entities/request-type.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminDepartmentsController } from './controllers/admin-departments.controller';
import { AdminDepartmentsService } from './services/admin-departments.service';
import { AdminWorkflowsController } from './controllers/admin-workflows.controller';
import { AdminWorkflowsService } from './services/admin-workflows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Department,
      Request,
      WorkflowTemplate,
      RequestType,
    ]),
  ],
  controllers: [
    AdminUsersController,
    AdminDepartmentsController,
    AdminWorkflowsController,
  ],
  providers: [
    AdminUsersService,
    AdminDepartmentsService,
    AdminWorkflowsService,
  ],
  exports: [
    AdminUsersService,
    AdminDepartmentsService,
    AdminWorkflowsService,
  ],
})
export class AdminModule {}
