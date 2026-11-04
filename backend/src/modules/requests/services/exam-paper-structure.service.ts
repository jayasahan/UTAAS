import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamPaperStructure } from '../../../database/entities/exam-paper-structure.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User } from '../../../database/entities/user.entity';

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
