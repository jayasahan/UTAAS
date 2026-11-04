import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../../database/entities/department.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { DepartmentQueryDto } from '../dto/department-query.dto';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

export interface DepartmentListItem {
  id: string;
  code: string;
  name: string;
  hod: User | null;
  staffCount: number;
  pendingRequestsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentDetailItem extends DepartmentListItem {
  totalRequestsCount: number;
}

export interface PaginatedDepartmentsResponse {
  data: DepartmentListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminDepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  /**
   * List academic departments with active HOD details, staff counts, and pending review counts.
   */
  async getDepartments(query: DepartmentQueryDto): Promise<PaginatedDepartmentsResponse> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const qb = this.departmentRepo.createQueryBuilder('dept');

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(dept.code) LIKE :term OR LOWER(dept.name) LIKE :term)', { term });
    }

    qb.orderBy('dept.code', 'ASC')
      .skip(skip)
      .take(limit);

    const [departments, total] = await qb.getManyAndCount();

    const data: DepartmentListItem[] = await Promise.all(
      departments.map((dept) => this.enrichDepartmentSummary(dept)),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get detailed department profile including HOD info, staff metrics, and submitted claim metrics.
   */
  async getDepartmentById(id: string): Promise<DepartmentDetailItem> {
    const dept = await this.departmentRepo.findOne({ where: { id } });
    if (!dept) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    const summary = await this.enrichDepartmentSummary(dept);

    const totalRequestsCount = await this.requestRepo
      .createQueryBuilder('req')
      .innerJoin('req.applicant', 'applicant')
      .where('applicant.departmentId = :deptId', { deptId: id })
      .getCount();

    return {
      ...summary,
      totalRequestsCount,
    };
  }

  /**
   * Create a new academic department and optionally assign the initial Head of Department.
   */
  async createDepartment(dto: CreateDepartmentDto): Promise<DepartmentDetailItem> {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    const existing = await this.departmentRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Department with code "${code}" already exists`);
    }

    const department = this.departmentRepo.create({
      code,
      name,
    });

    const savedDept = await this.departmentRepo.save(department);

    if (dto.hodUserId) {
      const candidateUser = await this.userRepo.findOne({ where: { id: dto.hodUserId } });
      if (!candidateUser) {
        throw new NotFoundException(`User with ID "${dto.hodUserId}" not found`);
      }

      candidateUser.role = UserRole.HOD;
      candidateUser.departmentId = savedDept.id;
      candidateUser.tokenVersion = (candidateUser.tokenVersion || 0) + 1;
      await this.userRepo.save(candidateUser);
    }

    return this.getDepartmentById(savedDept.id);
  }

  /**
   * Update department name, code, or reassign Head of Department.
   */
  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<DepartmentDetailItem> {
    const dept = await this.departmentRepo.findOne({ where: { id } });
    if (!dept) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== dept.code) {
        const existing = await this.departmentRepo.findOne({ where: { code } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Department code "${code}" is already in use`);
        }
        dept.code = code;
      }
    }

    if (dto.name) {
      dept.name = dto.name.trim();
    }

    // Handle Head of Department (HOD) reassignment or unassignment
    if (dto.hodUserId !== undefined) {
      const currentHods = await this.userRepo.find({
        where: { departmentId: id, role: UserRole.HOD },
      });

      if (dto.hodUserId === null) {
        // Unassign current HOD(s) and revert to LECTURER
        for (const currentHod of currentHods) {
          currentHod.role = UserRole.LECTURER;
          currentHod.tokenVersion = (currentHod.tokenVersion || 0) + 1;
          await this.userRepo.save(currentHod);
        }
      } else {
        const newHodUser = await this.userRepo.findOne({ where: { id: dto.hodUserId } });
        if (!newHodUser) {
          throw new NotFoundException(`User with ID "${dto.hodUserId}" not found`);
        }

        // Revert any previous HOD of this department to LECTURER
        for (const currentHod of currentHods) {
          if (currentHod.id !== newHodUser.id) {
            currentHod.role = UserRole.LECTURER;
            currentHod.tokenVersion = (currentHod.tokenVersion || 0) + 1;
            await this.userRepo.save(currentHod);
          }
        }

        // Appoint new HOD
        newHodUser.role = UserRole.HOD;
        newHodUser.departmentId = id;
        newHodUser.tokenVersion = (newHodUser.tokenVersion || 0) + 1;
        await this.userRepo.save(newHodUser);
      }
    }

    await this.departmentRepo.save(dept);
    return this.getDepartmentById(id);
  }

  /**
   * List all faculty staff members belonging to a department.
   */
  async getDepartmentStaff(id: string): Promise<User[]> {
    const dept = await this.departmentRepo.findOne({ where: { id } });
    if (!dept) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    const staff = await this.userRepo.find({
      where: { departmentId: id },
      order: { role: 'ASC', fullName: 'ASC' },
    });

    return staff.map((u) => this.sanitizeUser(u));
  }

  private async enrichDepartmentSummary(dept: Department): Promise<DepartmentListItem> {
    const hod = await this.userRepo.findOne({
      where: { departmentId: dept.id, role: UserRole.HOD, isActive: true },
    });

    const staffCount = await this.userRepo.count({
      where: { departmentId: dept.id, isActive: true },
    });

    const pendingRequestsCount = await this.requestRepo
      .createQueryBuilder('req')
      .innerJoin('req.applicant', 'applicant')
      .where('applicant.departmentId = :deptId', { deptId: dept.id })
      .andWhere('req.currentStageKey = :stageKey', { stageKey: 'HEAD_OF_DEPARTMENT' })
      .andWhere('req.status IN (:...statuses)', {
        statuses: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW],
      })
      .getCount();

    return {
      id: dept.id,
      code: dept.code,
      name: dept.name,
      hod: hod ? this.sanitizeUser(hod) : null,
      staffCount,
      pendingRequestsCount,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    };
  }

  private sanitizeUser(user: User): User {
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return sanitized;
  }
}
