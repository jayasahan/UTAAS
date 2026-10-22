import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
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

    // Query user by email with passwordHash included
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.department', 'department')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('University account has been deactivated');
      }

      // Password verification
      if (password && user.passwordHash) {
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          throw new UnauthorizedException('Invalid credentials: password does not match');
        }
      } else if (process.env.NODE_ENV === 'production') {
        if (!password) {
          throw new UnauthorizedException('Password is required for production authentication');
        }
        if (user.passwordHash) {
          const passwordMatches = await bcrypt.compare(password, user.passwordHash);
          if (!passwordMatches) {
            throw new UnauthorizedException('Invalid credentials: password does not match');
          }
        }
      }

      return user;
    }

    // Auto-provision unseeded university emails as LECTURER in default COM department (development only)
    if (normalizedEmail.endsWith('@eng.ruh.ac.lk') || normalizedEmail.endsWith('@ruh.ac.lk')) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException(
          `User account '${normalizedEmail}' is not registered. Dynamic auto-provisioning is strictly disabled in production.`,
        );
      }

      const defaultDept = await this.departmentRepository.findOne({
        where: { code: 'COM' },
      });

      const nameParts = normalizedEmail.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = nameParts
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const defaultPasswordHash = bcrypt.hashSync('Utaas@2026', 10);

      const newUser = this.userRepository.create({
        email: normalizedEmail,
        fullName: `Dr. ${formattedName}`,
        role: UserRole.LECTURER,
        passwordHash: defaultPasswordHash,
        department: defaultDept || undefined,
        departmentId: defaultDept?.id || undefined,
        isActive: true,
      });

      this.logger.log(`Auto-provisioning mock university user: ${normalizedEmail}`);
      return await this.userRepository.save(newUser);
    }

    throw new UnauthorizedException(
      `Invalid university identity: ${email}. Please use a registered university account or @eng.ruh.ac.lk email.`,
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
