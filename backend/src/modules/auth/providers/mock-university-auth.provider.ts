import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';
import { IAuthProvider } from '../interfaces/auth-provider.interface';

export interface TestActorInfo {
  email: string;
  name: string;
  role: UserRole;
  departmentCode: string | null;
  stageRole: string;
  description: string;
}

@Injectable()
export class MockUniversityAuthProvider implements IAuthProvider {
  private readonly logger = new Logger(MockUniversityAuthProvider.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async authenticate(email: string, password?: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists in the database
    let user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: ['department'],
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('University account has been deactivated');
      }
      return user;
    }

    // Auto-provision unseeded university emails as LECTURER in default COM department
    if (normalizedEmail.endsWith('@eng.ruh.ac.lk') || normalizedEmail.endsWith('@ruh.ac.lk')) {
      const defaultDept = await this.departmentRepository.findOne({
        where: { code: 'COM' },
      });

      const nameParts = normalizedEmail.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = nameParts
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      user = this.userRepository.create({
        email: normalizedEmail,
        fullName: `Dr. ${formattedName}`,
        role: UserRole.LECTURER,
        department: defaultDept || undefined,
        departmentId: defaultDept?.id || undefined,
        isActive: true,
      });

      this.logger.log(`Auto-provisioning mock university user: ${normalizedEmail}`);
      return await this.userRepository.save(user);
    }

    throw new UnauthorizedException(
      `Invalid university identity: ${email}. Please use a registered university test account or @eng.ruh.ac.lk email.`,
    );
  }

  getTestActors(): TestActorInfo[] {
    return [
      {
        email: 'lecturer@eng.ruh.ac.lk',
        name: 'Dr. Kamal Perera',
        role: UserRole.LECTURER,
        departmentCode: 'COM',
        stageRole: 'Claimant',
        description: 'Submits paper setting and marking claims; handles direct queries/resubmissions',
      },
      {
        email: 'hod.computer@eng.ruh.ac.lk',
        name: 'Prof. Sunimal Silva',
        role: UserRole.HOD,
        departmentCode: 'COM',
        stageRole: 'Stage 1: Head of Department',
        description: 'First approval checkpoint; scoped strictly to Department of Computer Engineering',
      },
      {
        email: 'dean@eng.ruh.ac.lk',
        name: 'Prof. Nimal Wickramasinghe',
        role: UserRole.DEAN,
        departmentCode: null,
        stageRole: 'Stage 2: Faculty Dean',
        description: 'Second approval checkpoint; faculty-wide executive sign-off',
      },
      {
        email: 'exam.officer@eng.ruh.ac.lk',
        name: 'Mr. Sarath Bandara',
        role: UserRole.EXAMINATION_OFFICER,
        departmentCode: null,
        stageRole: 'Stage 3: Examination Office',
        description: 'Validates exam duties and script counts; can return to HOD or query Lecturer',
      },
      {
        email: 'finance.officer@eng.ruh.ac.lk',
        name: 'Mrs. Chandrika Fernando',
        role: UserRole.FINANCIAL_OFFICER,
        departmentCode: null,
        stageRole: 'Stage 4: Financial Office',
        description: 'Calculates vote allowances and checks budgets; can return to HOD or query Lecturer',
      },
      {
        email: 'asst.bursar@eng.ruh.ac.lk',
        name: 'Mr. Rohan Jayasuriya',
        role: UserRole.ASSISTANT_BURSAR,
        departmentCode: null,
        stageRole: 'Stage 5 & 6: Assistant Bursar',
        description: 'Final financial voucher certification and payout disbursement',
      },
      {
        email: 'admin@eng.ruh.ac.lk',
        name: 'System Administrator',
        role: UserRole.ADMIN,
        departmentCode: null,
        stageRole: 'System Administrator',
        description: 'Manages workflow templates, department configurations, and system access',
      },
    ];
  }
}
