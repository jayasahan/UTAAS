import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExamPaperStructure } from '../../../database/entities/exam-paper-structure.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import {
  RequestStageHistory,
  StageAction,
} from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { FeeCalculationService } from './fee-calculation.service';
import { UpdateExamPaperStructureDto } from '../dto/update-exam-paper-structure.dto';
import { HodProportionDivisionDto } from '../dto/hod-proportion-division.dto';
import { LecturerProportionConsensusDto } from '../dto/lecturer-proportion-consensus.dto';

export interface SettingClaimantInfo {
  examinerId: string;
  examinerName: string;
  examinerEmail: string;
  questionsClaimed: number;
  proportion: number;
  trackingNumber: string;
  status: string;
}

export interface PaperStructureClaimsBreakdown {
  setting: {
    totalQuestions: number;
    claimedQuestions: number;
    remainingQuestions: number;
    isFullPaperClaimed: boolean;
    claimants: SettingClaimantInfo[];
  };
  mcqSetting: {
    totalMcqQuestions: number;
    claimedMcqQuestions: number;
    remainingMcqQuestions: number;
    claimants: any[];
  };
  moderation: {
    isClaimed: boolean;
    claimedBy?: string;
  };
  typing: {
    isClaimed: boolean;
    typedPagesClaimed: number;
    claimedBy?: string;
  };
  scriptMarking: {
    totalCandidates: number;
    totalScriptsClaimed: number;
    totalQuestionsMarked: number;
    remainingQuestionsPerScript: number;
    claimants: any[];
  };
  continuousAssessment: {
    maxAssessmentsPerStudent: number;
    totalStudentAssessmentsClaimed: number;
    maxTotalAssessmentsAllowed: number;
  };
}

export interface PaperStructureResponse {
  exists: boolean;
  message?: string;
  paperStructure?: ExamPaperStructure;
  claimsBreakdown?: PaperStructureClaimsBreakdown;
  hodProportionDivision?: any;
  structureChangeHistory?: any[];
  registeredBy?: {
    name: string;
    email: string;
    registeredAt: Date;
  };
}

@Injectable()
export class ExamPaperStructureService {
  private readonly logger = new Logger(ExamPaperStructureService.name);

  constructor(
    @InjectRepository(ExamPaperStructure)
    private readonly paperStructureRepo: Repository<ExamPaperStructure>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(RequestStageHistory)
    private readonly stageHistoryRepo: Repository<RequestStageHistory>,
    @InjectRepository(AuditEvent)
    private readonly auditEventRepo: Repository<AuditEvent>,
    private readonly feeCalculationService: FeeCalculationService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Look up authoritative paper structure and cross-examiner claim breakdown.
   */
  async getPaperStructureWithClaims(
    courseCode: string,
    academicYear: string,
    semester: string,
    examType: string,
  ): Promise<PaperStructureResponse> {
    const code = courseCode.trim().toUpperCase();
    const year = academicYear.trim();
    const sem = semester.trim();
    const type = examType.trim();

    const structure = await this.paperStructureRepo.findOne({
      where: {
        courseCode: code,
        academicYear: year,
        semester: sem,
        examType: type,
      },
    });

    if (!structure) {
      return {
        exists: false,
        message: `No examination paper structure registered yet for ${code} (${year} ${sem}). The first lecturer submitting will establish the paper structure.`,
      };
    }

    // Query active/in-flight/approved/settled claims for this identical paper
    const activeRequests = await this.queryClaimsForPaper(code, year, sem, type);
    const breakdown = this.aggregateClaimsForPaper(structure, activeRequests);

    return {
      exists: true,
      paperStructure: structure,
      claimsBreakdown: breakdown,
      hodProportionDivision: structure.hodProportionDivision || null,
      structureChangeHistory: structure.structureChangeHistory || [],
      registeredBy: {
        name: structure.registeredByName,
        email: structure.registeredByEmail,
        registeredAt: structure.createdAt,
      },
    };
  }

  /**
   * Validates incoming claim against authoritative paper structure and other examiners' claims.
   * If this is the first examiner, establishes and registers the paper structure in the database.
   */
  async validateAndEnforcePaperQuotas(
    applicant: User,
    metadata: any,
    paperRows: any[],
    currentRequestId?: string,
  ): Promise<ExamPaperStructure[]> {
    const registeredStructures: ExamPaperStructure[] = [];

    const academicYear = metadata?.academicYear?.trim();
    const semester = metadata?.semester?.trim();
    const examType = metadata?.examType?.trim();

    if (!academicYear || !semester || !examType) {
      return registeredStructures;
    }

    // Determine target paper rows
    const rowsToProcess = paperRows && paperRows.length > 0
      ? paperRows
      : [
          {
            title: metadata.courseTitle || metadata.courseCode,
            courseCode: metadata.courseCode,
            durationHours: 3,
            settingCount: 1,
          },
        ];

    for (const row of rowsToProcess) {
      const rawCode = row.courseCode || metadata.courseCode || '';
      const courseCode = this.extractCourseCode(rawCode, row.title);
      if (!courseCode) continue;

      let structure = await this.paperStructureRepo.findOne({
        where: {
          courseCode,
          academicYear,
          semester,
          examType,
        },
      });

      if (!structure) {
        // First examiner establishing paper structure!
        structure = await this.registerFirstExaminerStructure(
          applicant,
          courseCode,
          metadata,
          row,
        );
      } else {
        // Subsequent examiner or update: enforce cross-examiner quotas!
        await this.enforceCrossExaminerQuota(
          structure,
          applicant,
          row,
          currentRequestId,
        );
      }

      registeredStructures.push(structure);
    }

    return registeredStructures;
  }

  /**
   * Editable Paper Structure Correction & Approval Step 1 Reset:
   * If the first lecturer (or HOD/Admin) made a mistake about question numbers,
   * they can edit it. If edited, all downstream officer approvals are invalidated and
   * the claim(s) reset to Step 1 (HEAD_OF_DEPARTMENT) to go through the fresh approval process.
   */
  async updatePaperStructureAndResetApproval(
    user: User,
    dto: UpdateExamPaperStructureDto,
  ): Promise<{
    message: string;
    paperStructure: ExamPaperStructure;
    resetClaimsCount: number;
  }> {
    const code = dto.courseCode.trim().toUpperCase();
    const academicYear = dto.academicYear.trim();
    const semester = dto.semester.trim();
    const examType = dto.examType.trim();

    const structure = await this.paperStructureRepo.findOne({
      where: {
        courseCode: code,
        academicYear,
        semester,
        examType,
      },
    });

    if (!structure) {
      throw new NotFoundException(
        `Examination paper structure for ${code} (${academicYear} ${semester}) not found`,
      );
    }

    // Authorization: Only the original registrant, HOD, or Admin can edit the structure
    const isRegistrant = structure.registeredById === user.id;
    const isHod = user.role === UserRole.HOD;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isRegistrant && !isHod && !isAdmin) {
      throw new ForbiddenException(
        'Only the lecturer who established this paper structure, the Head of Department, or an administrator can edit the examination paper structure',
      );
    }

    // Validation against other examiners' already claimed questions
    if (dto.totalQuestions !== undefined && dto.totalQuestions < structure.totalQuestions) {
      const otherClaims = await this.queryClaimsForPaper(
        code,
        academicYear,
        semester,
        examType,
        structure.registeredById,
      );

      let otherClaimedQuestions = 0;
      const otherClaimants: string[] = [];

      for (const req of otherClaims) {
        const row = this.findMatchingRowInRequest(req, code);
        if (row) {
          const count = this.getSettingQuestionsClaimedInRow(row, structure.totalQuestions);
          if (count > 0) {
            otherClaimedQuestions += count;
            const name = req.applicant?.fullName || 'Examiner';
            otherClaimants.push(`${name} (${count} q)`);
          }
        }
      }

      if (dto.totalQuestions < otherClaimedQuestions) {
        throw new BadRequestException(
          `Cannot reduce total questions to ${dto.totalQuestions}. Other examiners have already claimed ${otherClaimedQuestions} question(s) [${otherClaimants.join(', ')}].`,
        );
      }
    }

    // Record change history
    const prevTotal = structure.totalQuestions;
    const historyEntry = {
      changedById: user.id,
      changedByName: user.fullName,
      previousTotalQuestions: prevTotal,
      newTotalQuestions: dto.totalQuestions ?? prevTotal,
      reason: dto.correctionReason,
      changedAt: new Date(),
    };

    structure.structureChangeHistory = [
      ...(structure.structureChangeHistory || []),
      historyEntry,
    ];

    if (dto.totalQuestions !== undefined) structure.totalQuestions = dto.totalQuestions;
    if (dto.totalMcqQuestions !== undefined) structure.totalMcqQuestions = dto.totalMcqQuestions;
    if (dto.totalCandidates !== undefined) structure.totalCandidates = dto.totalCandidates;
    if (dto.paperDurationHours !== undefined) structure.paperDurationHours = dto.paperDurationHours;
    if (dto.paperType !== undefined) structure.paperType = dto.paperType;
    if (dto.essayWeightPercent !== undefined) structure.essayWeightPercent = dto.essayWeightPercent;
    if (dto.mcqWeightPercent !== undefined) structure.mcqWeightPercent = dto.mcqWeightPercent;

    const savedStructure = await this.paperStructureRepo.save(structure);

    // Reset all submitted / under review claims to Step 1 (HEAD_OF_DEPARTMENT)
    const activeRequests = await this.queryClaimsForPaper(code, academicYear, semester, examType);
    let resetCount = 0;

    for (const req of activeRequests) {
      // 1. Synchronize paper rows with new totalQuestions and recalculate fees
      const papers = req.formData?.papers || [];
      for (const p of papers) {
        const pCode = this.extractCourseCode(p.courseCode, p.title);
        if (pCode === code) {
          if (p.settingShare) {
            p.settingShare.totalQuestions = savedStructure.totalQuestions;
            if (p.settingShare.questionsClaimed > savedStructure.totalQuestions) {
              p.settingShare.questionsClaimed = savedStructure.totalQuestions;
            }
            p.settingShare.proportion = p.settingShare.questionsClaimed / savedStructure.totalQuestions;
          }
          if (p.markingShare) {
            p.markingShare.totalQuestions = savedStructure.totalQuestions;
            if (p.markingShare.questionsClaimed > savedStructure.totalQuestions) {
              p.markingShare.questionsClaimed = savedStructure.totalQuestions;
            }
            p.markingShare.proportion = p.markingShare.questionsClaimed / savedStructure.totalQuestions;
          }
        }
      }

      const computedItems = req.formData?.items || this.feeCalculationService.aggregateFromPaperRows(papers);
      const feeCalculation = this.feeCalculationService.calculateClaimFees(computedItems, papers);

      req.formData = {
        ...req.formData,
        papers,
        items: computedItems,
        feeCalculation,
      };
      req.totalAmount = feeCalculation.totalAmount;

      // 2. Reset workflow progress to Step 1 (HEAD_OF_DEPARTMENT)
      const prevStatus = req.status;
      req.status = RequestStatus.UNDER_REVIEW;
      req.currentStageKey = 'HEAD_OF_DEPARTMENT';
      req.returningOfficerId = null;

      // 3. Reset Stage History: All stages from Stage 1 (HOD) onwards become PENDING
      const stageHistories = await this.stageHistoryRepo.find({
        where: { requestId: req.id },
        order: { stageOrder: 'ASC' },
      });

      for (const stg of stageHistories) {
        if (stg.stageOrder >= 1) {
          stg.action = StageAction.PENDING;
          stg.actorId = null;
          stg.completedAt = null;
          stg.comments = null;
          if (stg.stageKey === 'HEAD_OF_DEPARTMENT') {
            stg.enteredAt = new Date();
          } else {
            stg.enteredAt = null;
          }
          await this.stageHistoryRepo.save(stg);
        }
      }

      await this.requestRepo.save(req);

      // 4. Record Audit Event
      const audit = this.auditEventRepo.create({
        requestId: req.id,
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        actionType: 'PAPER_STRUCTURE_CORRECTED_RESET',
        previousStatus: String(prevStatus),
        newStatus: String(RequestStatus.UNDER_REVIEW),
        fieldDiff: {
          previousTotalQuestions: prevTotal,
          newTotalQuestions: savedStructure.totalQuestions,
          correctionReason: dto.correctionReason,
          resetToStage: 'HEAD_OF_DEPARTMENT',
          officerApprovalsRevoked: true,
          recalculatedTotalAmount: req.totalAmount,
        },
        comment: `Examination paper structure corrected by ${user.fullName} (${dto.correctionReason}). Approval workflow reset to Step 1 (Head of Department) for fresh review.`,
      });
      await this.auditEventRepo.save(audit);
      resetCount++;
    }

    this.logger.log(
      `Paper structure updated for ${code} by ${user.fullName}. ${resetCount} claim(s) reset to Step 1 (HOD).`,
    );

    return {
      message: `Paper structure updated successfully. ${resetCount} associated claim(s) have had downstream officer approvals revoked and reset to Step 1 (Head of Department) for fresh review.`,
      paperStructure: savedStructure,
      resetClaimsCount: resetCount,
    };
  }

  /**
   * Combined Paper (MCQ + Essay) Proportion Division by Head of Department:
   * HOD sets the proportion division (e.g. Essay 60%, MCQ 40%) which is then
   * dispatched to the examiners/lecturers for their approval/consensus.
   */
  async dividePaperProportionByHod(
    hodUser: User,
    dto: HodProportionDivisionDto,
  ): Promise<ExamPaperStructure> {
    if (hodUser.role !== UserRole.HOD && hodUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only the Head of Department or an administrator can assign paper proportion divisions',
      );
    }

    const code = dto.courseCode.trim().toUpperCase();
    const academicYear = dto.academicYear.trim();
    const semester = dto.semester.trim();
    const examType = dto.examType.trim();

    const sum = Number(dto.essayWeightPercent) + Number(dto.mcqWeightPercent);
    if (Math.round(sum) !== 100) {
      throw new BadRequestException(
        `Proportion division must total 100%. Provided: Essay ${dto.essayWeightPercent}% + MCQ ${dto.mcqWeightPercent}% = ${sum}%`,
      );
    }

    const structure = await this.paperStructureRepo.findOne({
      where: { courseCode: code, academicYear, semester, examType },
    });

    if (!structure) {
      throw new NotFoundException(
        `Paper structure for ${code} (${academicYear} ${semester}) not found. First examiner must submit paper details first.`,
      );
    }

    structure.essayWeightPercent = dto.essayWeightPercent;
    structure.mcqWeightPercent = dto.mcqWeightPercent;
    structure.paperType = 'COMBINED';
    structure.hodProportionDivision = {
      essayWeightPercent: dto.essayWeightPercent,
      mcqWeightPercent: dto.mcqWeightPercent,
      comments: dto.comments || '',
      setByHodId: hodUser.id,
      setByHodName: hodUser.fullName,
      setAt: new Date(),
      status: 'AWAITING_LECTURER_CONSENSUS',
      responses: [],
    };

    const savedStructure = await this.paperStructureRepo.save(structure);

    // Route active claims to LECTURER_PROPORTION_CONSENSUS stage for review
    const claims = await this.queryClaimsForPaper(code, academicYear, semester, examType);
    for (const req of claims) {
      req.currentStageKey = 'LECTURER_PROPORTION_CONSENSUS';
      req.formData = {
        ...req.formData,
        hodProportionDivision: structure.hodProportionDivision,
      };
      await this.requestRepo.save(req);

      const audit = this.auditEventRepo.create({
        requestId: req.id,
        actorId: hodUser.id,
        actorName: hodUser.fullName,
        actorRole: hodUser.role,
        actionType: 'HOD_PROPORTION_DIVIDED',
        previousStatus: String(req.status),
        newStatus: String(req.status),
        fieldDiff: {
          essayWeightPercent: dto.essayWeightPercent,
          mcqWeightPercent: dto.mcqWeightPercent,
          status: 'AWAITING_LECTURER_CONSENSUS',
        },
        comment: `Head of Department ${hodUser.fullName} set paper proportion division: Essay ${dto.essayWeightPercent}%, MCQ ${dto.mcqWeightPercent}%. Routed to examiners for consensus.`,
      });
      await this.auditEventRepo.save(audit);
    }

    this.logger.log(
      `HOD Proportion Division set for ${code}: Essay ${dto.essayWeightPercent}%, MCQ ${dto.mcqWeightPercent}%`,
    );
    return savedStructure;
  }

  /**
   * Examiner / Lecturer Proportion Consensus:
   * Lecturers review the HOD's proposed proportion division.
   * If agree: consensus is recorded; once all examiners agree, consensus is finalized and routed to HOD.
   * If disagree: requires comments and returns the claim back to HOD so HOD can change/adjust the proportions.
   */
  async recordLecturerProportionConsensus(
    lecturerUser: User,
    dto: LecturerProportionConsensusDto,
  ): Promise<{
    status: string;
    message: string;
    paperStructure: ExamPaperStructure;
  }> {
    const code = dto.courseCode.trim().toUpperCase();
    const academicYear = dto.academicYear.trim();
    const semester = dto.semester.trim();
    const examType = dto.examType.trim();

    const structure = await this.paperStructureRepo.findOne({
      where: { courseCode: code, academicYear, semester, examType },
    });

    if (!structure || !structure.hodProportionDivision) {
      throw new BadRequestException('No pending HOD proportion division found for this examination paper');
    }

    if (
      structure.hodProportionDivision.status !== 'AWAITING_LECTURER_CONSENSUS' &&
      structure.hodProportionDivision.status !== 'DISAGREED_RETURNED_TO_HOD'
    ) {
      throw new BadRequestException(
        `HOD proportion division is currently in '${structure.hodProportionDivision.status}' state and not accepting new responses.`,
      );
    }

    if (!dto.agreed && (!dto.comments || !dto.comments.trim())) {
      throw new BadRequestException('Comments are mandatory when disagreeing with the HOD proportion division');
    }

    const claims = await this.queryClaimsForPaper(code, academicYear, semester, examType);
    const isClaimant = claims.some((c) => c.applicantId === lecturerUser.id);
    if (!isClaimant && lecturerUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only lecturers who have submitted claims for this examination paper can participate in proportion consensus',
      );
    }

    // Update or add lecturer response
    const existingIndex = structure.hodProportionDivision.responses.findIndex(
      (r) => r.lecturerId === lecturerUser.id,
    );
    const responseRecord = {
      lecturerId: lecturerUser.id,
      lecturerName: lecturerUser.fullName,
      agreed: dto.agreed,
      comments: dto.comments || '',
      respondedAt: new Date(),
    };

    if (existingIndex >= 0) {
      structure.hodProportionDivision.responses[existingIndex] = responseRecord;
    } else {
      structure.hodProportionDivision.responses.push(responseRecord);
    }

    // Case 1: Lecturer Disagrees
    if (!dto.agreed) {
      structure.hodProportionDivision.status = 'DISAGREED_RETURNED_TO_HOD';
      await this.paperStructureRepo.save(structure);

      for (const req of claims) {
        req.currentStageKey = 'HEAD_OF_DEPARTMENT';
        req.formData = {
          ...req.formData,
          hodProportionDivision: structure.hodProportionDivision,
          latestDisagreement: {
            lecturerName: lecturerUser.fullName,
            comment: dto.comments,
            respondedAt: new Date(),
          },
        };
        await this.requestRepo.save(req);

        const audit = this.auditEventRepo.create({
          requestId: req.id,
          actorId: lecturerUser.id,
          actorName: lecturerUser.fullName,
          actorRole: lecturerUser.role,
          actionType: 'LECTURER_PROPORTION_DISAGREED',
          previousStatus: String(req.status),
          newStatus: String(req.status),
          fieldDiff: {
            disagreedBy: lecturerUser.fullName,
            comment: dto.comments,
            returnedTo: 'HEAD_OF_DEPARTMENT',
          },
          comment: `Examiner ${lecturerUser.fullName} disagreed with HOD proportion division: "${dto.comments}". Claim returned to Head of Department for adjustment.`,
        });
        await this.auditEventRepo.save(audit);
      }

      return {
        status: 'DISAGREED_RETURNED_TO_HOD',
        message: `Your disagreement was recorded. The claim has been returned to the Head of Department with your feedback: "${dto.comments}".`,
        paperStructure: structure,
      };
    }

    // Case 2: Lecturer Agrees
    const distinctClaimantIds = Array.from(new Set(claims.map((c) => c.applicantId)));
    const agreedClaimantIds = structure.hodProportionDivision.responses
      .filter((r) => r.agreed)
      .map((r) => r.lecturerId);

    const allAgreed = distinctClaimantIds.every((id) => agreedClaimantIds.includes(id));

    if (allAgreed) {
      structure.hodProportionDivision.status = 'CONSENSUS_REACHED';
      await this.paperStructureRepo.save(structure);

      for (const req of claims) {
        // Apply agreed proportions and recalculate fees
        const papers = req.formData?.papers || [];
        for (const p of papers) {
          const pCode = this.extractCourseCode(p.courseCode, p.title);
          if (pCode === code) {
            p.combinedPaperConfig = {
              ...(p.combinedPaperConfig || {}),
              isCombinedPaper: true,
              essayWeightPercent: structure.essayWeightPercent,
              mcqWeightPercent: structure.mcqWeightPercent,
            };
          }
        }
        const computedItems = req.formData?.items || this.feeCalculationService.aggregateFromPaperRows(papers);
        const feeCalculation = this.feeCalculationService.calculateClaimFees(computedItems, papers);

        req.formData = {
          ...req.formData,
          papers,
          items: computedItems,
          feeCalculation,
          hodProportionDivision: structure.hodProportionDivision,
        };
        req.totalAmount = feeCalculation.totalAmount;
        req.currentStageKey = 'HEAD_OF_DEPARTMENT'; // Ready for HOD final signoff/recommendation

        await this.requestRepo.save(req);

        const audit = this.auditEventRepo.create({
          requestId: req.id,
          actorId: lecturerUser.id,
          actorName: lecturerUser.fullName,
          actorRole: lecturerUser.role,
          actionType: 'PROPORTION_CONSENSUS_REACHED',
          previousStatus: String(req.status),
          newStatus: String(req.status),
          fieldDiff: {
            agreedWeights: {
              essay: structure.essayWeightPercent,
              mcq: structure.mcqWeightPercent,
            },
            status: 'CONSENSUS_REACHED',
          },
          comment: `All examiners agreed on HOD proportion division (Essay ${structure.essayWeightPercent}%, MCQ ${structure.mcqWeightPercent}%). Forwarded to Head of Department for formal review.`,
        });
        await this.auditEventRepo.save(audit);
      }

      return {
        status: 'CONSENSUS_REACHED',
        message: 'All examiners have agreed on the proportion division. Consensus reached and claim routed to Head of Department.',
        paperStructure: structure,
      };
    } else {
      await this.paperStructureRepo.save(structure);
      return {
        status: 'AWAITING_OTHER_EXAMINERS',
        message: 'Your agreement has been recorded. Waiting for other co-examiners to confirm consensus.',
        paperStructure: structure,
      };
    }
  }

  private async registerFirstExaminerStructure(
    applicant: User,
    courseCode: string,
    metadata: any,
    row: any,
  ): Promise<ExamPaperStructure> {
    const totalQuestions =
      row.settingShare?.totalQuestions ||
      row.markingShare?.totalQuestions ||
      5;

    const totalMcqQuestions = row.combinedPaperConfig?.mcqQuestionCount || 0;
    const totalCandidates = row.scriptCount || metadata?.candidateCount || 0;
    const paperDurationHours = row.durationHours || 3;
    const essayWeight = row.combinedPaperConfig?.essayWeightPercent ?? 100;
    const mcqWeight = row.combinedPaperConfig?.mcqWeightPercent ?? 0;
    const paperType = row.combinedPaperConfig?.isCombinedPaper
      ? 'COMBINED'
      : totalMcqQuestions > 0
      ? 'MCQ'
      : 'ESSAY';

    const newStructure = this.paperStructureRepo.create({
      courseCode,
      courseTitle: metadata?.courseTitle || row.title || courseCode,
      academicYear: metadata.academicYear.trim(),
      semester: metadata.semester.trim(),
      examType: metadata.examType.trim(),
      paperType,
      paperDurationHours,
      totalQuestions,
      totalMcqQuestions,
      totalCandidates,
      essayWeightPercent: essayWeight,
      mcqWeightPercent: mcqWeight,
      registeredById: applicant.id,
      registeredByName: applicant.fullName,
      registeredByEmail: applicant.email,
    });

    const saved = await this.paperStructureRepo.save(newStructure);
    this.logger.log(
      `Paper Structure established for ${courseCode} (${metadata.academicYear} ${metadata.semester}) by ${applicant.fullName} [${totalQuestions} questions, ${totalCandidates} candidates]`,
    );
    return saved;
  }

  private async enforceCrossExaminerQuota(
    structure: ExamPaperStructure,
    applicant: User,
    row: any,
    currentRequestId?: string,
  ): Promise<void> {
    // 1. Synchronize total questions with authoritative structure
    if (row.settingShare) {
      row.settingShare.totalQuestions = structure.totalQuestions;
      if (row.settingShare.isShared && row.settingShare.questionsClaimed !== undefined) {
        row.settingShare.proportion = row.settingShare.questionsClaimed / structure.totalQuestions;
      }
    }
    if (row.markingShare) {
      row.markingShare.totalQuestions = structure.totalQuestions;
      if (row.markingShare.isShared && row.markingShare.questionsClaimed !== undefined) {
        row.markingShare.proportion = row.markingShare.questionsClaimed / structure.totalQuestions;
      }
    }

    // Query claims by OTHER examiners for this identical paper
    const otherClaims = await this.queryClaimsForPaper(
      structure.courseCode,
      structure.academicYear,
      structure.semester,
      structure.examType,
      applicant.id,
      currentRequestId,
    );

    // 2. Validate Paper Setting Quota
    const incomingSettingQuestions = this.getSettingQuestionsClaimedInRow(row, structure.totalQuestions);
    if (incomingSettingQuestions > 0) {
      let alreadyClaimedQuestions = 0;
      const otherClaimants: string[] = [];

      for (const req of otherClaims) {
        const otherRow = this.findMatchingRowInRequest(req, structure.courseCode);
        if (otherRow) {
          const count = this.getSettingQuestionsClaimedInRow(otherRow, structure.totalQuestions);
          if (count > 0) {
            alreadyClaimedQuestions += count;
            const name = req.applicant?.fullName || 'Another Examiner';
            otherClaimants.push(`${name} (${count} q)`);
          }
        }
      }

      const remainingSetting = Math.max(0, structure.totalQuestions - alreadyClaimedQuestions);

      if (incomingSettingQuestions > remainingSetting) {
        throw new BadRequestException(
          `Paper Setting quota exceeded for ${structure.courseCode} (${structure.academicYear} ${structure.semester}): Total questions is ${structure.totalQuestions} (registered by ${structure.registeredByName}). ${alreadyClaimedQuestions} question(s) have already been claimed by [${otherClaimants.join(', ')}]. You can claim at most ${remainingSetting} question(s).`,
        );
      }
    }

    // 3. Validate Moderation (Only 1 examiner can claim moderation per paper)
    if (row.moderationCount > 0) {
      for (const req of otherClaims) {
        const otherRow = this.findMatchingRowInRequest(req, structure.courseCode);
        if (otherRow && otherRow.moderationCount > 0) {
          const name = req.applicant?.fullName || 'Another examiner';
          throw new BadRequestException(
            `Paper moderation for ${structure.courseCode} (${structure.academicYear} ${structure.semester}) has already been claimed by ${name}. Only one moderation is permitted per examination paper.`,
          );
        }
      }
    }

    // 4. Validate Typing (Only 1 examiner can claim typing per paper, max 5 pages)
    if (row.typedPageCount > 0) {
      for (const req of otherClaims) {
        const otherRow = this.findMatchingRowInRequest(req, structure.courseCode);
        if (otherRow && otherRow.typedPageCount > 0) {
          throw new BadRequestException(
            `Paper typing for ${structure.courseCode} has already been claimed by another examiner.`,
          );
        }
      }
    }

    // 5. Validate Script Marking Quota
    if (row.markingShare?.isShared && row.markingShare.questionsClaimed > 0) {
      let alreadyMarkedQuestions = 0;
      for (const req of otherClaims) {
        const otherRow = this.findMatchingRowInRequest(req, structure.courseCode);
        if (otherRow?.markingShare?.isShared) {
          alreadyMarkedQuestions += (otherRow.markingShare.questionsClaimed || 0);
        }
      }

      const remainingMarkingQuestions = Math.max(0, structure.totalQuestions - alreadyMarkedQuestions);
      if (row.markingShare.questionsClaimed > remainingMarkingQuestions) {
        throw new BadRequestException(
          `Script Marking question quota exceeded for ${structure.courseCode}: Total questions is ${structure.totalQuestions}. ${alreadyMarkedQuestions} question(s) already marked by other examiners. You can claim at most ${remainingMarkingQuestions} question(s).`,
        );
      }
    }
  }

  private async queryClaimsForPaper(
    courseCode: string,
    academicYear: string,
    semester: string,
    examType: string,
    excludeApplicantId?: string,
    excludeRequestId?: string,
  ): Promise<Request[]> {
    const qb = this.requestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.applicant', 'applicant')
      .where("req.status NOT IN (:...excludedStatuses)", {
        excludedStatuses: [RequestStatus.DRAFT, RequestStatus.REJECTED],
      })
      .andWhere("req.formData->'metadata'->>'academicYear' = :academicYear", { academicYear })
      .andWhere("req.formData->'metadata'->>'semester' = :semester", { semester })
      .andWhere("req.formData->'metadata'->>'examType' = :examType", { examType });

    if (excludeApplicantId) {
      qb.andWhere('req.applicantId != :excludeApplicantId', { excludeApplicantId });
    }
    if (excludeRequestId) {
      qb.andWhere('req.id != :excludeRequestId', { excludeRequestId });
    }

    const requests = await qb.getMany();

    // Filter requests that reference this specific course code in metadata or in paper rows
    return requests.filter((r) => {
      const metaCode = r.formData?.metadata?.courseCode;
      if (metaCode && metaCode.trim().toUpperCase() === courseCode) {
        return true;
      }
      const papers = r.formData?.papers || [];
      return papers.some((p: any) => this.extractCourseCode(p.courseCode, p.title) === courseCode);
    });
  }

  private aggregateClaimsForPaper(
    structure: ExamPaperStructure,
    requests: Request[],
  ): PaperStructureClaimsBreakdown {
    let claimedSettingQuestions = 0;
    const settingClaimants: SettingClaimantInfo[] = [];

    let isModerationClaimed = false;
    let moderatorName: string | undefined;

    let isTypingClaimed = false;
    let typedPages = 0;
    let typedByName: string | undefined;

    let totalScriptsClaimed = 0;
    let questionsMarked = 0;
    const markingClaimants: any[] = [];

    for (const req of requests) {
      const row = this.findMatchingRowInRequest(req, structure.courseCode);
      if (!row) continue;

      const applicantName = req.applicant?.fullName || 'Examiner';
      const applicantEmail = req.applicant?.email || '';

      // Setting
      const settingQ = this.getSettingQuestionsClaimedInRow(row, structure.totalQuestions);
      if (settingQ > 0) {
        claimedSettingQuestions += settingQ;
        settingClaimants.push({
          examinerId: req.applicantId,
          examinerName: applicantName,
          examinerEmail: applicantEmail,
          questionsClaimed: settingQ,
          proportion: settingQ / structure.totalQuestions,
          trackingNumber: req.trackingNumber,
          status: req.status,
        });
      }

      // Moderation
      if (row.moderationCount > 0) {
        isModerationClaimed = true;
        moderatorName = applicantName;
      }

      // Typing
      if (row.typedPageCount > 0) {
        isTypingClaimed = true;
        typedPages += row.typedPageCount;
        typedByName = applicantName;
      }

      // Script marking
      if (row.scriptCount > 0) {
        totalScriptsClaimed += row.scriptCount;
        const qCount = row.markingShare?.isShared
          ? (row.markingShare.questionsClaimed || structure.totalQuestions)
          : structure.totalQuestions;
        questionsMarked = Math.max(questionsMarked, qCount);
        markingClaimants.push({
          examinerName: applicantName,
          scriptsMarked: row.scriptCount,
          questionsMarked: qCount,
          trackingNumber: req.trackingNumber,
        });
      }
    }

    const remainingQuestions = Math.max(0, structure.totalQuestions - claimedSettingQuestions);

    return {
      setting: {
        totalQuestions: structure.totalQuestions,
        claimedQuestions: claimedSettingQuestions,
        remainingQuestions,
        isFullPaperClaimed: claimedSettingQuestions >= structure.totalQuestions,
        claimants: settingClaimants,
      },
      mcqSetting: {
        totalMcqQuestions: structure.totalMcqQuestions,
        claimedMcqQuestions: 0,
        remainingMcqQuestions: structure.totalMcqQuestions,
        claimants: [],
      },
      moderation: {
        isClaimed: isModerationClaimed,
        claimedBy: moderatorName,
      },
      typing: {
        isClaimed: isTypingClaimed,
        typedPagesClaimed: Math.min(5, typedPages),
        claimedBy: typedByName,
      },
      scriptMarking: {
        totalCandidates: structure.totalCandidates,
        totalScriptsClaimed,
        totalQuestionsMarked: questionsMarked,
        remainingQuestionsPerScript: Math.max(0, structure.totalQuestions - questionsMarked),
        claimants: markingClaimants,
      },
      continuousAssessment: {
        maxAssessmentsPerStudent: 4,
        totalStudentAssessmentsClaimed: 0,
        maxTotalAssessmentsAllowed: structure.totalCandidates * 4,
      },
    };
  }

  private getSettingQuestionsClaimedInRow(row: any, defaultTotal: number): number {
    if (!row) return 0;
    if (row.settingShare?.isShared) {
      return Number(row.settingShare.questionsClaimed) || 0;
    }
    if (Number(row.settingCount) > 0) {
      return defaultTotal;
    }
    return 0;
  }

  private findMatchingRowInRequest(req: Request, targetCourseCode: string): any {
    const papers = req.formData?.papers || [];
    for (const paper of papers) {
      const code = this.extractCourseCode(paper.courseCode, paper.title);
      if (code === targetCourseCode) return paper;
    }
    const metaCode = req.formData?.metadata?.courseCode;
    if (metaCode && metaCode.trim().toUpperCase() === targetCourseCode) {
      return req.formData?.items || {};
    }
    return null;
  }

  private extractCourseCode(rawCode?: string, title?: string): string {
    if (rawCode && rawCode.trim()) {
      return rawCode.trim().toUpperCase();
    }
    if (title) {
      const match = title.match(/([A-Z]{2}[0-9]{4})/i);
      if (match) return match[1].toUpperCase();
    }
    return '';
  }
}
