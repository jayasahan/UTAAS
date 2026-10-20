import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { WorkflowStateMachineService } from '../services/workflow-state-machine.service';
import { TransitionActionDto } from '../dto/transition-action.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';

@ApiTags('Workflow Engine & State Machine')
@Controller('requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowStateMachineService) {}

  @Post(':id/actions')
  @ApiOperation({
    summary: 'Execute Workflow State Transition Action',
    description:
      'Performs an atomic workflow action (APPROVE, REJECT_RETURN, APPROVE_PAYOUT, RESUBMIT, SETTLE, DIRECT_QUERY) validating role permissions and updating the immutable audit log',
  })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiResponse({ status: 200, description: 'Workflow state transition successful' })
  @ApiResponse({ status: 400, description: 'Invalid transition action or stage precondition failed' })
  @ApiResponse({ status: 403, description: 'Forbidden: Actor lacks required role or department scope' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async executeAction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: TransitionActionDto,
  ) {
    return await this.workflowService.executeTransition(id, user, dto);
  }
}
