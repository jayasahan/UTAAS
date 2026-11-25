import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';
import { Request } from '../../../database/entities/request.entity';
import { AdminUserQueryDto } from '../dto/admin-user-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { ToggleUserStatusDto } from '../dto/toggle-user-status.dto';

export const DEFAULT_ADMIN_CREATED_PASSWORD = 'Utaas@2026';

export interface PaginatedUsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  /**
   * List users with optional search, filtering, and pagination.
   */
  async getUsers(query: AdminUserQueryDto): Promise<PaginatedUsersResponse> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'dept');

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(user.fullName) LIKE :term OR LOWER(user.email) LIKE :term)', { term });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.departmentId) {
      qb.andWhere('user.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    const sanitized = users.map((u) => this.sanitizeUser(u));

    return {
      data: sanitized,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve a user by ID along with their department and count of submitted requests.
   */
  async getUserById(id: string): Promise<User & { requestsCount: number }> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['department'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const requestsCount = await this.requestRepo.count({
      where: { applicantId: id },
    });

    return {
      ...this.sanitizeUser(user),
      requestsCount,
    };
  }

  /**
   * Register a new user in the system with role and department assignment.
   */
  async createUser(dto: CreateAdminUserDto): Promise<User & { requestsCount: number }> {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    if (dto.departmentId) {
      const department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
      if (!department) {
        throw new BadRequestException(`Department with ID "${dto.departmentId}" not found`);
      }
    } else if (dto.role === UserRole.LECTURER || dto.role === UserRole.HOD) {
      throw new BadRequestException(`Department assignment is required for ${dto.role} role`);
    }

    const rawPassword = dto.password?.trim() || DEFAULT_ADMIN_CREATED_PASSWORD;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const newUser = this.userRepo.create({
      email,
      fullName: dto.fullName.trim(),
      role: dto.role,
      designation: dto.designation?.trim() || null,
      staffId: dto.staffId?.trim() || null,
      departmentId: dto.departmentId || null,
      passwordHash,
      isActive: true,
      tokenVersion: 0,
    });

    const savedUser = await this.userRepo.save(newUser);
    return this.getUserById(savedUser.id);
  }

  /**
   * Update an existing user's details, role, department, or reset their password.
   */
  async updateUser(id: string, dto: UpdateAdminUserDto): Promise<User & { requestsCount: number }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Email "${normalizedEmail}" is already taken by another user`);
        }
        user.email = normalizedEmail;
      }
    }

    if (dto.fullName) {
      user.fullName = dto.fullName.trim();
    }

    if (dto.designation !== undefined) {
      user.designation = dto.designation ? dto.designation.trim() : null;
    }

    if (dto.staffId !== undefined) {
      user.staffId = dto.staffId ? dto.staffId.trim() : null;
    }

    if (dto.departmentId !== undefined) {
      if (dto.departmentId === null) {
        user.departmentId = null as any;
      } else {
        const dept = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
        if (!dept) {
          throw new BadRequestException(`Department with ID "${dto.departmentId}" not found`);
        }
        user.departmentId = dto.departmentId;
      }
    }

    if (dto.role && dto.role !== user.role) {
      user.role = dto.role;
      // Invalidate current JWT sessions when user role changes
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    // Role-department consistency rule
    if ((user.role === UserRole.LECTURER || user.role === UserRole.HOD) && !user.departmentId) {
      throw new BadRequestException(`Department assignment is required for ${user.role} role`);
    }

    if (dto.password && dto.password.trim()) {
      user.passwordHash = await bcrypt.hash(dto.password.trim(), 10);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await this.userRepo.save(user);
    return this.getUserById(id);
  }

  /**
   * Toggle user active/deactivated state with security safeguards.
   */
  async toggleUserStatus(
    id: string,
    dto: ToggleUserStatusDto,
    currentAdmin: User,
  ): Promise<{ message: string; user: User & { requestsCount: number } }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Prevent administrators from deactivating their own account
    if (user.id === currentAdmin.id && !dto.isActive) {
      throw new BadRequestException('Administrators cannot deactivate their own account');
    }

    // Prevent deactivating the last active Administrator
    if (user.role === UserRole.ADMIN && !dto.isActive) {
      const activeAdminCount = await this.userRepo.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException('Cannot deactivate the sole active Administrator in the system');
      }
    }

    if (!dto.isActive && user.isActive) {
      // Invalidate active JWT tokens immediately upon deactivation
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    user.isActive = dto.isActive;
    await this.userRepo.save(user);

    const updatedUser = await this.getUserById(id);
    return {
      message: `User account has been successfully ${dto.isActive ? 'activated' : 'deactivated'}`,
      user: updatedUser,
    };
  }

  private sanitizeUser(user: User): User {
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return sanitized;
  }
}
