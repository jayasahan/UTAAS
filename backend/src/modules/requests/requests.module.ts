import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from '../../database/entities/request.entity';
import { RequestType } from '../../database/entities/request-type.entity';
import { WorkflowTemplate } from '../../database/entities/workflow-template.entity';
import { RequestStageHistory } from '../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../database/entities/audit-event.entity';
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { AuthModule } from '../auth/auth.module';
import { FeeCalculationService } from './services/fee-calculation.service';
import { TrackingNumberService } from './services/tracking-number.service';
import { PaperMarkingClaimService } from './services/paper-marking-claim.service';
import { WorkflowStateMachineService } from './services/workflow-state-machine.service';
import { TrackingHistoryService } from './services/tracking-history.service';
import { PaperMarkingController } from './controllers/paper-marking.controller';
import { WorkflowController } from './controllers/workflow.controller';
import { TrackingHistoryController } from './controllers/tracking-history.controller';
import { DocumentsController } from './controllers/documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      RequestType,
      WorkflowTemplate,
      RequestStageHistory,
      AuditEvent,
      User,
      Department,
    ]),
    AuthModule,
  ],
  controllers: [
    PaperMarkingController,
    WorkflowController,
    TrackingHistoryController,
    DocumentsController,
  ],
  providers: [
    FeeCalculationService,
    TrackingNumberService,
    PaperMarkingClaimService,
    WorkflowStateMachineService,
    TrackingHistoryService,
  ],
  exports: [
    FeeCalculationService,
    TrackingNumberService,
    PaperMarkingClaimService,
    WorkflowStateMachineService,
    TrackingHistoryService,
  ],
})
export class RequestsModule {}
