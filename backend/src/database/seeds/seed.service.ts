import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Department } from '../entities/department.entity';
import { User, UserRole } from '../entities/user.entity';
import { RequestType } from '../entities/request-type.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { CourseModule } from '../entities/course-module.entity';

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
        departmentId: departments['EIE']?.id || departments['COM']?.id,
      },
      {
        email: 'hod.computer@eng.ruh.ac.lk',
        fullName: 'Prof. K.U. Herath',
        role: UserRole.HOD,
        departmentId: departments['EIE']?.id || departments['COM']?.id,
      },
      {
        email: 'hod.civil@eng.ruh.ac.lk',
        fullName: 'Prof. D.M. Silva',
        role: UserRole.HOD,
        departmentId: departments['CEE']?.id || departments['CIV']?.id,
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
      {
        email: 'admin@eng.ruh.ac.lk',
        fullName: 'System Administrator',
        role: UserRole.ADMIN,
        departmentId: null,
      },
    ];

    for (const def of userDefs) {
      const exists = await this.userRepo
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: def.email })
        .getOne();

      if (!exists) {
        await this.userRepo.save(
          this.userRepo.create({
            ...def,
            passwordHash: defaultPasswordHash,
          }),
        );
        this.logger.log(`Seeded User: ${def.fullName} (${def.role}) with default password`);
      } else if (!exists.passwordHash) {
        exists.passwordHash = defaultPasswordHash;
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
    const isDept = departments['IS'];
    const ceeDept = departments['CEE'] || departments['CIV'];
    const eieDept = departments['EIE'] || departments['COM'];
    const mmeDept = departments['MME'] || departments['MEC'];
    const menaDept = departments['MENA'];

    const moduleDefinitions = [
      // Semester 1 (Common First Year)
      { code: 'IS1301', name: 'Mathematics I for Engineers', prefix: 'IS', semester: 1, credits: 3, dept: isDept },
      { code: 'IS1302', name: 'Communication Skills for Engineers', prefix: 'IS', semester: 1, credits: 3, dept: isDept },
      { code: 'CE1201', name: 'Introduction to Civil Engineering', prefix: 'CE', semester: 1, credits: 2, dept: ceeDept },
      { code: 'EE1201', name: 'Principles of Electrical Engineering', prefix: 'EE', semester: 1, credits: 2, dept: eieDept },
      { code: 'ME1201', name: 'Engineering Mechanics', prefix: 'ME', semester: 1, credits: 2, dept: mmeDept },
      { code: 'EC1201', name: 'Introduction to Computing', prefix: 'EC', semester: 1, credits: 2, dept: eieDept },

      // Semester 2 (Common First Year)
      { code: 'IS2301', name: 'Mathematics II - Calculus & Linear Algebra', prefix: 'IS', semester: 2, credits: 3, dept: isDept },
      { code: 'IS2202', name: 'Society and the Engineer', prefix: 'IS', semester: 2, credits: 2, dept: isDept },
      { code: 'CE2301', name: 'Fluid Mechanics', prefix: 'CE', semester: 2, credits: 3, dept: ceeDept },
      { code: 'EE2301', name: 'Network Analysis', prefix: 'EE', semester: 2, credits: 3, dept: eieDept },
      { code: 'ME2301', name: 'Applied Thermodynamics', prefix: 'ME', semester: 2, credits: 3, dept: mmeDept },
      { code: 'EC2301', name: 'Object Oriented Programming', prefix: 'EC', semester: 2, credits: 3, dept: eieDept },

      // Semester 3 (Field Specialization)
      { code: 'IS3301', name: 'Advanced Engineering Mathematics', prefix: 'IS', semester: 3, credits: 3, dept: isDept },
      { code: 'CE3301', name: 'Structural Analysis I', prefix: 'CE', semester: 3, credits: 3, dept: ceeDept },
      { code: 'CE3302', name: 'Mechanics of Materials', prefix: 'CE', semester: 3, credits: 3, dept: ceeDept },
      { code: 'EE3301', name: 'Electric Circuit Theory', prefix: 'EE', semester: 3, credits: 3, dept: eieDept },
      { code: 'EE3302', name: 'Analog Electronics', prefix: 'EE', semester: 3, credits: 3, dept: eieDept },
      { code: 'EC3301', name: 'Data Structures and Algorithms', prefix: 'EC', semester: 3, credits: 3, dept: eieDept },
      { code: 'EC3302', name: 'Digital Logic Design', prefix: 'EC', semester: 3, credits: 3, dept: eieDept },
      { code: 'ME3301', name: 'Engineering Thermodynamics', prefix: 'ME', semester: 3, credits: 3, dept: mmeDept },
      { code: 'ME3302', name: 'Materials Science & Metallurgy', prefix: 'ME', semester: 3, credits: 3, dept: mmeDept },
      { code: 'MN3301', name: 'Introduction to Naval Architecture', prefix: 'MN', semester: 3, credits: 3, dept: menaDept },

      // Semester 4
      { code: 'IS4201', name: 'Engineering Economics & Accountancy', prefix: 'IS', semester: 4, credits: 2, dept: isDept },
      { code: 'CE4301', name: 'Geotechnical Engineering I', prefix: 'CE', semester: 4, credits: 3, dept: ceeDept },
      { code: 'CE4302', name: 'Hydraulic Engineering', prefix: 'CE', semester: 4, credits: 3, dept: ceeDept },
      { code: 'EE4301', name: 'Signals and Systems', prefix: 'EE', semester: 4, credits: 3, dept: eieDept },
      { code: 'EE4302', name: 'Microprocessor Systems', prefix: 'EE', semester: 4, credits: 3, dept: eieDept },
      { code: 'EC4301', name: 'Computer Architecture', prefix: 'EC', semester: 4, credits: 3, dept: eieDept },
      { code: 'EC4302', name: 'Software Engineering Fundamentals', prefix: 'EC', semester: 4, credits: 3, dept: eieDept },
      { code: 'ME4301', name: 'Theory of Machines', prefix: 'ME', semester: 4, credits: 3, dept: mmeDept },
      { code: 'ME4302', name: 'Manufacturing Technology', prefix: 'ME', semester: 4, credits: 3, dept: mmeDept },
      { code: 'MN4301', name: 'Ship Hydrostatics and Stability', prefix: 'MN', semester: 4, credits: 3, dept: menaDept },

      // Semester 5
      { code: 'IS5301', name: 'Probability and Statistics for Engineers', prefix: 'IS', semester: 5, credits: 3, dept: isDept },
      { code: 'IS5302', name: 'Operations Research & Quantitative Methods', prefix: 'IS', semester: 5, credits: 3, dept: isDept },
      { code: 'CE5301', name: 'Reinforced Concrete Design I', prefix: 'CE', semester: 5, credits: 3, dept: ceeDept },
      { code: 'CE5302', name: 'Transportation Engineering', prefix: 'CE', semester: 5, credits: 3, dept: ceeDept },
      { code: 'EE5301', name: 'Power Systems Engineering', prefix: 'EE', semester: 5, credits: 3, dept: eieDept },
      { code: 'EE5302', name: 'Control Systems Engineering', prefix: 'EE', semester: 5, credits: 3, dept: eieDept },
      { code: 'EC5060', name: 'Software Engineering Project', prefix: 'EC', semester: 5, credits: 3, dept: eieDept },
      { code: 'EC5070', name: 'Computer Networks', prefix: 'EC', semester: 5, credits: 3, dept: eieDept },
      { code: 'EC5080', name: 'Database Systems', prefix: 'EC', semester: 5, credits: 3, dept: eieDept },
      { code: 'ME5301', name: 'Heat and Mass Transfer', prefix: 'ME', semester: 5, credits: 3, dept: mmeDept },
      { code: 'ME5302', name: 'Machine Design', prefix: 'ME', semester: 5, credits: 3, dept: mmeDept },
      { code: 'MN5301', name: 'Marine Propulsion Systems', prefix: 'MN', semester: 5, credits: 3, dept: menaDept },

      // Semester 6
      { code: 'IS6201', name: 'Principles of Management', prefix: 'IS', semester: 6, credits: 2, dept: isDept },
      { code: 'CE6301', name: 'Structural Steel Design', prefix: 'CE', semester: 6, credits: 3, dept: ceeDept },
      { code: 'CE6302', name: 'Environmental Engineering', prefix: 'CE', semester: 6, credits: 3, dept: ceeDept },
      { code: 'EE6301', name: 'Digital Signal Processing', prefix: 'EE', semester: 6, credits: 3, dept: eieDept },
      { code: 'EE6302', name: 'Electrical Machines and Drives', prefix: 'EE', semester: 6, credits: 3, dept: eieDept },
      { code: 'EC6010', name: 'Operating Systems', prefix: 'EC', semester: 6, credits: 3, dept: eieDept },
      { code: 'EC6020', name: 'Advanced Computer Architecture', prefix: 'EC', semester: 6, credits: 3, dept: eieDept },
      { code: 'ME6301', name: 'Applied Fluid Dynamics', prefix: 'ME', semester: 6, credits: 3, dept: mmeDept },
      { code: 'ME6302', name: 'Finite Element Analysis', prefix: 'ME', semester: 6, credits: 3, dept: mmeDept },
      { code: 'MN6301', name: 'Ship Resistance and Propulsion', prefix: 'MN', semester: 6, credits: 3, dept: menaDept },

      // Semester 7
      { code: 'IS7301', name: 'Industrial Law & Ethics', prefix: 'IS', semester: 7, credits: 3, dept: isDept },
      { code: 'CE7301', name: 'Highway Design & Pavement Engineering', prefix: 'CE', semester: 7, credits: 3, dept: ceeDept },
      { code: 'EE7301', name: 'High Voltage Engineering', prefix: 'EE', semester: 7, credits: 3, dept: eieDept },
      { code: 'EC7010', name: 'Artificial Intelligence & Machine Learning', prefix: 'EC', semester: 7, credits: 3, dept: eieDept },
      { code: 'EC7020', name: 'Distributed Systems & Cloud Computing', prefix: 'EC', semester: 7, credits: 3, dept: eieDept },
      { code: 'ME7301', name: 'Automobile Engineering & Mechatronics', prefix: 'ME', semester: 7, credits: 3, dept: mmeDept },
      { code: 'MN7301', name: 'Ship Structure Design', prefix: 'MN', semester: 7, credits: 3, dept: menaDept },

      // Semester 8
      { code: 'IS8301', name: 'Technology Management & Entrepreneurship', prefix: 'IS', semester: 8, credits: 3, dept: isDept },
      { code: 'CE8601', name: 'Civil Engineering Final Year Project', prefix: 'CE', semester: 8, credits: 6, dept: ceeDept },
      { code: 'EE8601', name: 'Electrical & Information Engineering FYP', prefix: 'EE', semester: 8, credits: 6, dept: eieDept },
      { code: 'EC8010', name: 'Cybersecurity & Cryptography', prefix: 'EC', semester: 8, credits: 3, dept: eieDept },
      { code: 'EC8601', name: 'Computer Engineering Final Year Project', prefix: 'EC', semester: 8, credits: 6, dept: eieDept },
      { code: 'ME8601', name: 'Mechanical Engineering Final Year Project', prefix: 'ME', semester: 8, credits: 6, dept: mmeDept },
      { code: 'MN8601', name: 'Marine Engineering Comprehensive Project', prefix: 'MN', semester: 8, credits: 6, dept: menaDept },
    ];

    for (const def of moduleDefinitions) {
      const exists = await this.courseModuleRepo.findOne({ where: { code: def.code } });
      if (!exists && def.dept) {
        await this.courseModuleRepo.save(
          this.courseModuleRepo.create({
            code: def.code,
            name: def.name,
            prefix: def.prefix,
            semester: def.semester,
            credits: def.credits,
            departmentId: def.dept.id,
            isActive: true,
          }),
        );
      }
    }
    this.logger.log(`Checked & seeded ${moduleDefinitions.length} Engineering Course Modules`);
  }
}
