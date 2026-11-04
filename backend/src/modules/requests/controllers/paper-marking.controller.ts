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
import { AdminModulesService } from '../../admin/services/admin-modules.service';
import { ExamPaperStructureService } from '../services/exam-paper-structure.service';
import { CreatePaperMarkingClaimDto } from '../dto/create-paper-marking-claim.dto';
import { SaveDraftClaimDto } from '../dto/save-draft-claim.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import {
  ACADEMIC_YEAR_OPTIONS,
  SEMESTER_OPTIONS,
  DEGREE_PROGRAMME_OPTIONS,
  EXAM_TYPE_OPTIONS,
  EXAMINER_ROLE_OPTIONS,
  PAPER_DURATION_OPTIONS,
  SCRIPT_EVALUATION_TYPES,
  DOCUMENT_CATEGORY_OPTIONS,
  ENGINEERING_COURSE_MODULES,
} from '../constants/examination-options.constant';

@ApiTags('Paper Marking Claims')
@Controller('requests/paper-marking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaperMarkingController {
  constructor(
    private readonly claimService: PaperMarkingClaimService,
    private readonly feeCalculationService: FeeCalculationService,
    private readonly adminModulesService: AdminModulesService,
    private readonly examPaperStructureService: ExamPaperStructureService,
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

  @Get('options/form-dropdowns')
  @ApiOperation({
    summary: 'Get Standardized Form Dropdown Options for Engineering Faculty',
    description:
      'Provides pre-configured dropdown choices for academic year, semester, degree programs, course modules, examination types, roles, and paper durations to minimize typing for lecturers. Dynamically filters modules by semester and department.',
  })
  @ApiQuery({ name: 'semester', required: false, type: Number, description: 'Filter modules by semester (1-8)' })
  @ApiQuery({ name: 'departmentId', required: false, type: String, description: 'Filter modules by department UUID' })
  @ApiQuery({ name: 'departmentCode', required: false, type: String, description: 'Filter modules by department code (CEE, MME, EIE, IS, MENA)' })
  @ApiResponse({ status: 200, description: 'Standardized dropdown options retrieved' })
  async getFormDropdownOptions(
    @CurrentUser() user?: User,
    @Query('semester') semester?: number,
    @Query('departmentId') departmentId?: string,
    @Query('departmentCode') departmentCode?: string,
  ) {
    const targetDeptId = departmentId || (departmentCode ? undefined : user?.departmentId);
    const targetDeptCode = departmentCode || (departmentId ? undefined : user?.department?.code);

    let courseModules: any[] = [];
    try {
      courseModules = await this.adminModulesService.getFilteredModulesForClaim(
        semester ? Number(semester) : undefined,
        targetDeptId,
        targetDeptCode,
      );
    } catch {
      // Fallback
    }

    if (!courseModules || courseModules.length === 0) {
      courseModules = ENGINEERING_COURSE_MODULES;
    }

    return {
      academicYears: ACADEMIC_YEAR_OPTIONS,
      semesters: SEMESTER_OPTIONS,
      degreeProgrammes: DEGREE_PROGRAMME_OPTIONS,
      examTypes: EXAM_TYPE_OPTIONS,
      examinerRoles: EXAMINER_ROLE_OPTIONS,
      paperDurations: PAPER_DURATION_OPTIONS,
      scriptEvaluationTypes: SCRIPT_EVALUATION_TYPES,
      documentCategories: DOCUMENT_CATEGORY_OPTIONS,
      courseModules,
      userDepartmentCode: user?.department?.code || null,
    };
  }

  @Get('paper-structure')
  @ApiOperation({
    summary: 'Get Examination Paper Structure and Cross-Examiner Claim Breakdown',
    description:
      'Retrieves the registered paper structure (total questions, MCQ questions, candidates), who registered it, and current claimed vs remaining quotas for setting, marking, moderation, and typing.',
  })
  @ApiQuery({ name: 'courseCode', required: true, description: 'Course code e.g. EC5060, IS5302' })
  @ApiQuery({ name: 'academicYear', required: true, description: 'Academic year e.g. 2023/2024' })
  @ApiQuery({ name: 'semester', required: true, description: 'Semester e.g. Semester 1 or 5' })
  @ApiQuery({ name: 'examType', required: true, description: 'Exam type e.g. End Semester Examination' })
  @ApiResponse({ status: 200, description: 'Paper structure and claims breakdown retrieved' })
  async getPaperStructure(
    @Query('courseCode') courseCode: string,
    @Query('academicYear') academicYear: string,
    @Query('semester') semester: string,
    @Query('examType') examType: string,
  ) {
    return await this.examPaperStructureService.getPaperStructureWithClaims(
      courseCode,
      academicYear,
      semester,
      examType,
    );
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
      'Validates form data, enforces cross-examiner quotas against registered paper structure, calculates official fees server-side, assigns a tracking number, and transitions the claim to Stage 1 (HOD Review)',
  })
  @ApiQuery({ name: 'draftId', required: false, description: 'Optional draft ID to promote to submitted' })
  @ApiResponse({ status: 201, description: 'Claim successfully submitted and routed to HOD' })
  @ApiResponse({ status: 400, description: 'Validation failure, quota exceeded, or zero claim amount' })
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
