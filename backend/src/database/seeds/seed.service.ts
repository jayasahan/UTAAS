import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../entities/department.entity';
import { User, UserRole } from '../entities/user.entity';
import { RequestType } from '../entities/request-type.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RequestType)
    private readonly requestTypeRepo: Repository<RequestType>,
    @InjectRepository(WorkflowTemplate)
    private readonly workflowTemplateRepo: Repository<WorkflowTemplate>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedAll();
    } catch (err) {
      this.logger.warn(`Database seeding deferred (database not ready or offline): ${err.message}`);
    }
  }

  async seedAll() {
    this.logger.log('Checking database seed data...');
    const departments = await this.seedDepartments();
    await this.seedUsers(departments);
    const paperMarkingType = await this.seedRequestTypes();
    await this.seedWorkflowTemplates(paperMarkingType);
    this.logger.log('Database seed check completed successfully.');
  }

  private async seedDepartments(): Promise<Record<string, Department>> {
    const deptDefs = [
      { code: 'COM', name: 'Department of Computer Engineering' },
      { code: 'CIV', name: 'Department of Civil and Environmental Engineering' },
      { code: 'EIE', name: 'Department of Electrical and Information Engineering' },
      { code: 'MEC', name: 'Department of Mechanical and Manufacturing Engineering' },
    ];

    const result: Record<string, Department> = {};
    for (const def of deptDefs) {
      let dept = await this.departmentRepo.findOne({ where: { code: def.code } });
      if (!dept) {
        dept = await this.departmentRepo.save(this.departmentRepo.create(def));
        this.logger.log(`Seeded Department: ${dept.code} - ${dept.name}`);
      }
      result[dept.code] = dept;
    }
    return result;
  }

  private async seedUsers(departments: Record<string, Department>) {
    const userDefs = [
      {
        email: 'lecturer@eng.ruh.ac.lk',
        fullName: 'Dr. Hansana H.A.J.',
        role: UserRole.LECTURER,
        departmentId: departments['COM']?.id,
      },
      {
        email: 'hod.computer@eng.ruh.ac.lk',
        fullName: 'Prof. K.U. Herath',
        role: UserRole.HOD,
        departmentId: departments['COM']?.id,
      },
      {
        email: 'hod.civil@eng.ruh.ac.lk',
        fullName: 'Prof. D.M. Silva',
        role: UserRole.HOD,
        departmentId: departments['CIV']?.id,
      },
      {
        email: 'dean@eng.ruh.ac.lk',
        fullName: 'Dr. P.S. Ranawaka',
        role: UserRole.DEAN,
        departmentId: null,
      },
      {
        email: 'exam.officer@eng.ruh.ac.lk',
        fullName: 'Mr. A.N.V. Fernando',
        role: UserRole.EXAMINATION_OFFICER,
        departmentId: null,
      },
      {
        email: 'finance.officer@eng.ruh.ac.lk',
        fullName: 'Mrs. S.K. Perera',
        role: UserRole.FINANCIAL_OFFICER,
        departmentId: null,
      },
      {
        email: 'asst.bursar@eng.ruh.ac.lk',
        fullName: 'Mr. W.M. Bandara',
        role: UserRole.ASSISTANT_BURSAR,
        departmentId: null,
      },
    ];

    for (const def of userDefs) {
      const exists = await this.userRepo.findOne({ where: { email: def.email } });
      if (!exists) {
        await this.userRepo.save(this.userRepo.create(def));
        this.logger.log(`Seeded User: ${def.fullName} (${def.role})`);
      }
    }
  }

  private async seedRequestTypes(): Promise<RequestType> {
    const code = 'PAPER_MARKING';
    let reqType = await this.requestTypeRepo.findOne({ where: { code } });
    if (!reqType) {
      reqType = await this.requestTypeRepo.save(
        this.requestTypeRepo.create({
          code,
          name: 'Paper Setting, Marking & Assessment Payment Claim',
          description:
            'Claim remuneration for paper setting, moderating, script marking, and oral/practical examination duties.',
          isActive: true,
        }),
      );
      this.logger.log(`Seeded RequestType: ${reqType.code}`);
    }
    return reqType;
  }

  private async seedWorkflowTemplates(requestType: RequestType) {
    let template = await this.workflowTemplateRepo.findOne({
      where: { requestTypeId: requestType.id, version: 1 },
    });

    if (!template) {
      template = await this.workflowTemplateRepo.save(
        this.workflowTemplateRepo.create({
          requestTypeId: requestType.id,
          version: 1,
          isActive: true,
          stages: [
            {
              order: 0,
              stageKey: 'SUBMISSION',
              stageName: 'Lecturer Submission',
              requiredRole: UserRole.LECTURER,
            },
            {
              order: 1,
              stageKey: 'HEAD_OF_DEPARTMENT',
              stageName: 'Head of the Department Recommendation',
              requiredRole: UserRole.HOD,
              isDepartmentScoped: true,
            },
            {
              order: 2,
              stageKey: 'DEAN',
              stageName: 'Dean Faculty Approval',
              requiredRole: UserRole.DEAN,
            },
            {
              order: 3,
              stageKey: 'EXAMINATION_OFFICE',
              stageName: 'Examination Office Checking & Verification',
              requiredRole: UserRole.EXAMINATION_OFFICER,
            },
            {
              order: 4,
              stageKey: 'FINANCIAL_OFFICE',
              stageName: 'Financial Office Audit & Rate Certification',
              requiredRole: UserRole.FINANCIAL_OFFICER,
            },
            {
              order: 5,
              stageKey: 'ASSISTANT_BURSAR',
              stageName: 'Assistant Bursar Payout Authorization & Settlement',
              requiredRole: UserRole.ASSISTANT_BURSAR,
            },
          ],
        }),
      );
      this.logger.log(`Seeded 6-Stage WorkflowTemplate v1 for ${requestType.code}`);
    }
  }
}
