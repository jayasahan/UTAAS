import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Department } from '../entities/department.entity';
import { User, UserRole } from '../entities/user.entity';
import { RequestType } from '../entities/request-type.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { CourseModule } from '../entities/course-module.entity';
import { HANDBOOK_COURSE_MODULES } from './data/handbook-course-modules.data';

export const DEFAULT_SEED_PASSWORD = 'Utaas@2026';

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
    @InjectRepository(CourseModule)
    private readonly courseModuleRepo: Repository<CourseModule>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAll();
  }

  async seedAll() {
    this.logger.log('Executing database seed check...');
    const departments = await this.seedDepartments();
    await this.seedUsers(departments);
    const requestType = await this.seedRequestTypes();
    await this.seedWorkflowTemplates(requestType);
    await this.seedCourseModules(departments);
    this.logger.log('Database seed check completed successfully.');
  }

  private async seedDepartments(): Promise<Record<string, Department>> {
    const deptDefs = [
      { code: 'CEE', name: 'Department of Civil and Environmental Engineering' },
      { code: 'MME', name: 'Department of Mechanical and Manufacturing Engineering' },
      { code: 'EIE', name: 'Department of Electrical and Information Engineering' },
      { code: 'IS', name: 'Department of Interdisciplinary Studies' },
      { code: 'MENA', name: 'Department of Marine Engineering and Naval Architecture' },
      // Legacy code support for backwards-compatibility with initial seeds
      { code: 'COM', name: 'Department of Computer Engineering' },
      { code: 'CIV', name: 'Department of Civil and Environmental Engineering' },
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
    // Security Guard: Never seed default personas or shared default passwords in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.log('Production environment detected: Skipping automated default test persona and shared password seeding.');
      return;
    }

    const defaultPasswordHash = bcrypt.hashSync(DEFAULT_SEED_PASSWORD, 10);

    const userDefs = [
      {
        email: 'lecturer@eng.ruh.ac.lk',
        fullName: 'Dr. Hansana H.A.J.',
        role: UserRole.LECTURER,
        designation: 'Senior Lecturer (Grade II)',
        staffId: 'ENG/AC/0101',
        departmentId: departments['EIE']?.id || departments['COM']?.id,
      },
      {
        email: 'hod.computer@eng.ruh.ac.lk',
        fullName: 'Prof. K.U. Herath',
        role: UserRole.HOD,
        designation: 'Professor',
        staffId: 'ENG/AC/0102',
        departmentId: departments['EIE']?.id || departments['COM']?.id,
      },
      {
        email: 'hod.civil@eng.ruh.ac.lk',
        fullName: 'Prof. D.M. Silva',
        role: UserRole.HOD,
        designation: 'Professor',
        staffId: 'ENG/AC/0201',
        departmentId: departments['CEE']?.id || departments['CIV']?.id,
      },
      {
        email: 'dean@eng.ruh.ac.lk',
        fullName: 'Dr. P.S. Ranawaka',
        role: UserRole.DEAN,
        designation: 'Associate Professor',
        staffId: 'ENG/AC/0301',
        departmentId: null,
      },
      {
        email: 'exam.officer@eng.ruh.ac.lk',
        fullName: 'Mr. A.N.V. Fernando',
        role: UserRole.EXAMINATION_OFFICER,
        designation: 'Senior Assistant Registrar (Examinations)',
        staffId: 'ENG/AD/0012',
        departmentId: null,
      },
      {
        email: 'finance.officer@eng.ruh.ac.lk',
        fullName: 'Mrs. S.K. Perera',
        role: UserRole.FINANCIAL_OFFICER,
        designation: 'Senior Assistant Bursar',
        staffId: 'ENG/FN/0008',
        departmentId: null,
      },
      {
        email: 'asst.bursar@eng.ruh.ac.lk',
        fullName: 'Mr. W.M. Bandara',
        role: UserRole.ASSISTANT_BURSAR,
        designation: 'Assistant Bursar',
        staffId: 'ENG/FN/0015',
        departmentId: null,
      },
      {
        email: 'admin@eng.ruh.ac.lk',
        fullName: 'System Administrator',
        role: UserRole.ADMIN,
        designation: 'System Administrator',
        staffId: 'ENG/IT/0001',
        departmentId: null,
      },
    ];

    for (const def of userDefs) {
      const exists = await this.userRepo.findOne({ where: { email: def.email } });
      if (!exists) {
        const user = this.userRepo.create({
          email: def.email,
          fullName: def.fullName,
          role: def.role,
          designation: def.designation,
          staffId: def.staffId,
          departmentId: def.departmentId,
          passwordHash: defaultPasswordHash,
          isActive: true,
        });
        await this.userRepo.save(user);
        this.logger.log(`Seeded User: ${def.email} (${def.role})`);
      } else {
        // Ensure development accounts have the standard default password hash so tests pass
        exists.passwordHash = defaultPasswordHash;
        exists.role = def.role;
        exists.fullName = def.fullName;
        exists.designation = def.designation;
        exists.staffId = def.staffId;
        if (def.departmentId) exists.departmentId = def.departmentId;
        await this.userRepo.save(exists);
        this.logger.log(`Updated User password hash for: ${def.email}`);
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
          isActive: true,
        }),
      );
      this.logger.log(`Seeded 6-Stage WorkflowTemplate v1 for ${requestType.code}`);
    }
  }

  private async seedCourseModules(departments: Record<string, Department>) {
    const deptMap: Record<string, Department> = {
      IS: departments['IS'],
      CEE: departments['CEE'] || departments['CIV'],
      EIE: departments['EIE'] || departments['COM'],
      MME: departments['MME'] || departments['MEC'],
      MENA: departments['MENA'],
    };

    let seededCount = 0;
    let updatedCount = 0;

    for (const def of HANDBOOK_COURSE_MODULES) {
      const dept = deptMap[def.departmentCode];
      if (!dept) continue;

      let module = await this.courseModuleRepo.findOne({ where: { code: def.code } });
      if (!module) {
        await this.courseModuleRepo.save(
          this.courseModuleRepo.create({
            code: def.code,
            name: def.name,
            prefix: def.prefix,
            semester: def.semester,
            credits: def.credits,
            departmentId: dept.id,
            isActive: true,
          }),
        );
        seededCount++;
      } else {
        let changed = false;
        if (module.name !== def.name) { module.name = def.name; changed = true; }
        if (module.prefix !== def.prefix) { module.prefix = def.prefix; changed = true; }
        if (module.semester !== def.semester) { module.semester = def.semester; changed = true; }
        if (module.credits !== def.credits) { module.credits = def.credits; changed = true; }
        if (module.departmentId !== dept.id) { module.departmentId = dept.id; changed = true; }
        if (changed) {
          await this.courseModuleRepo.save(module);
          updatedCount++;
        }
      }
    }

    this.logger.log(
      `Checked & synchronized ${HANDBOOK_COURSE_MODULES.length} Student Handbook Course Modules (new: ${seededCount}, updated: ${updatedCount})`,
    );
  }
}
