import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { Request } from '../../database/entities/request.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminDepartmentsController } from './controllers/admin-departments.controller';
import { AdminDepartmentsService } from './services/admin-departments.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Department, Request])],
  controllers: [AdminUsersController, AdminDepartmentsController],
  providers: [AdminUsersService, AdminDepartmentsService],
  exports: [AdminUsersService, AdminDepartmentsService],
})
export class AdminModule {}
