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
import { PaperMarkingController } from './controllers/paper-marking.controller';

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
  controllers: [PaperMarkingController],
  providers: [
    FeeCalculationService,
    TrackingNumberService,
    PaperMarkingClaimService,
  ],
  exports: [
    FeeCalculationService,
    TrackingNumberService,
    PaperMarkingClaimService,
  ],
})
export class RequestsModule {}
