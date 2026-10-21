import {
  Controller,
  Post,
  Get,
  Body,
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
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PaperMarkingClaimService } from '../services/paper-marking-claim.service';
import { FeeCalculationService } from '../services/fee-calculation.service';
import { CreatePaperMarkingClaimDto } from '../dto/create-paper-marking-claim.dto';
import { SaveDraftClaimDto } from '../dto/save-draft-claim.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';

@ApiTags('Paper Marking Claims')
@Controller('requests/paper-marking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaperMarkingController {
  constructor(
    private readonly claimService: PaperMarkingClaimService,
    private readonly feeCalculationService: FeeCalculationService,
  ) {}

  @Get('rates/circular')
  @ApiOperation({
    summary: 'Get Approved Examination Remuneration Rates',
    description: 'Returns official university circular rates and line-item calculation criteria',
  })
  @ApiResponse({ status: 200, description: 'Circular rates retrieved' })
  getApprovedRates() {
    return this.feeCalculationService.getApprovedRates();
  }

  @Post('draft')
  @ApiOperation({
    summary: 'Save Paper Marking Claim Draft',
    description:
      'Saves partial examination claim details (metadata, personal info, multiple paper rows, documents) without triggering the approval workflow',
  })
  @ApiQuery({ name: 'draftId', required: false, description: 'Existing draft ID to update' })
  @ApiResponse({ status: 201, description: 'Draft saved successfully' })
  async saveDraft(
    @CurrentUser() user: User,
    @Body() dto: SaveDraftClaimDto,
    @Query('draftId') draftId?: string,
  ) {
    return await this.claimService.saveDraft(user, dto, draftId);
  }

  @Post('submit')
  @ApiOperation({
    summary: 'Submit Paper Marking Claim into Approval Workflow',
    description:
      'Validates form data, calculates official fees server-side, assigns a tracking number, and transitions the claim to Stage 1 (HOD Review)',
  })
  @ApiQuery({ name: 'draftId', required: false, description: 'Optional draft ID to promote to submitted' })
  @ApiResponse({ status: 201, description: 'Claim successfully submitted and routed to HOD' })
  @ApiResponse({ status: 400, description: 'Validation failure or zero claim amount' })
  async submitClaim(
    @CurrentUser() user: User,
    @Body() dto: CreatePaperMarkingClaimDto,
    @Query('draftId') draftId?: string,
  ) {
    return await this.claimService.submitClaim(user, dto, draftId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Paper Marking Claim Details',
    description: 'Retrieves claim details, fee breakdowns, and current workflow stage',
  })
  @ApiParam({ name: 'id', description: 'Claim UUID' })
  @ApiResponse({ status: 200, description: 'Claim details retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Accessing claims outside user role/department' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async getClaimById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return await this.claimService.getClaimById(id, user);
  }
}
