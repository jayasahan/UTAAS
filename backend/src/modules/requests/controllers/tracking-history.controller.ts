import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TrackingHistoryService } from '../services/tracking-history.service';
import { TrackingResponseDto } from '../dto/tracking-response.dto';
import { HistoryResponseDto } from '../dto/history-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';

@ApiTags('Request Tracking & Audit History')
@Controller('requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrackingHistoryController {
  constructor(private readonly trackingHistoryService: TrackingHistoryService) {}

  @Get('my-requests')
  @ApiOperation({
    summary: 'Get Logged-in Lecturer Claims',
    description: 'Returns paginated list of examination payment claims submitted by the authenticated user',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'List of submitted requests' })
  async getMyRequests(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return await this.trackingHistoryService.getMyRequests(user, Number(page), Number(limit));
  }

  @Get('pending-queue')
  @ApiOperation({
    summary: 'Get Reviewer Pending Action Queue',
    description:
      'Returns pending claims awaiting action by the current reviewer role, scoped by department where applicable',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'List of pending requests awaiting action' })
  async getPendingQueue(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return await this.trackingHistoryService.getPendingQueue(user, Number(page), Number(limit));
  }

  @Get(':id/tracking')
  @ApiOperation({
    summary: 'Get Request Stage Stepper & Tracking Status',
    description:
      'Returns the real-time tracking progression, active office holder, and visual stage stepper history',
  })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiResponse({ status: 200, description: 'Tracking status details', type: TrackingResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: IDOR protection or department boundary restriction' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getTrackingInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TrackingResponseDto> {
    return await this.trackingHistoryService.getTrackingInfo(id, user);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get Immutable Audit Event History',
    description:
      'Returns the complete chronological audit trail with reviewer remarks, transition timestamps, and field diffs',
  })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiResponse({ status: 200, description: 'Audit history events', type: HistoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: IDOR protection or department boundary restriction' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getAuditHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<HistoryResponseDto> {
    return await this.trackingHistoryService.getAuditHistory(id, user);
  }
}
