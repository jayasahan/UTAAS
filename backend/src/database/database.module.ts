import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Department,
  User,
  RequestType,
  WorkflowTemplate,
  Request,
  RequestStageHistory,
  AuditEvent,
  CourseModule,
} from './entities';
import { SeedService } from './seeds/seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      User,
      RequestType,
      WorkflowTemplate,
      Request,
      RequestStageHistory,
      AuditEvent,
      CourseModule,
    ]),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule, SeedService],
})
export class DatabaseModule {}
