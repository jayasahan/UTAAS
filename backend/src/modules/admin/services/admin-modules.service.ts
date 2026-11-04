import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseModule } from '../../../database/entities/course-module.entity';
import { Department } from '../../../database/entities/department.entity';
import { CreateCourseModuleDto } from '../dto/create-course-module.dto';
import { UpdateCourseModuleDto } from '../dto/update-course-module.dto';
import { CourseModuleQueryDto } from '../dto/course-module-query.dto';
import { parseModuleCode } from '../utils/module-code-parser.util';

export interface FormDropdownModuleItem {
  code: string;
  title: string;
  departmentCode: string;
  semester: number;
  credits: number;
}

export interface PaginatedModulesResponse {
  data: CourseModule[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminModulesService {
  constructor(
    @InjectRepository(CourseModule)
    private readonly moduleRepo: Repository<CourseModule>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  /**
   * List modules for administrator with pagination and multi-field filtering.
   */
  async getModules(query: CourseModuleQueryDto): Promise<PaginatedModulesResponse> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const qb = this.moduleRepo
      .createQueryBuilder('mod')
      .leftJoinAndSelect('mod.department', 'dept');

    if (query.departmentId) {
      qb.andWhere('mod.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    if (query.departmentCode && query.departmentCode.trim()) {
      qb.andWhere('LOWER(dept.code) = :deptCode', {
        deptCode: query.departmentCode.trim().toLowerCase(),
      });
    }

    if (query.semester) {
      qb.andWhere('mod.semester = :semester', { semester: Number(query.semester) });
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(mod.code) LIKE :term OR LOWER(mod.name) LIKE :term)', { term });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('mod.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('mod.semester', 'ASC')
      .addOrderBy('mod.code', 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

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
   * Query course modules filtered for lecturer paper marking claim forms.
   * Applies Ruhuna Engineering academic rules:
   * - Common first year: Semesters 1 & 2 have modules from all departments except MENA.
   * - Semesters 3-8: Field specialization by department.
   *   - CEE offers CE prefix
   *   - EIE offers both EE and EC (Computer Engineering) prefixes
   *   - MME offers ME prefix
   *   - MENA offers MN prefix
   * - IS (Interdisciplinary Studies) modules are common and available to all departments.
   */
  async getFilteredModulesForClaim(
    semester?: number,
    departmentId?: string,
    departmentCode?: string,
  ): Promise<FormDropdownModuleItem[]> {
    let resolvedDeptCode: string | null = departmentCode ? departmentCode.trim().toUpperCase() : null;

    if (!resolvedDeptCode && departmentId) {
      const dept = await this.departmentRepo.findOne({ where: { id: departmentId } });
      if (dept) {
        resolvedDeptCode = dept.code.trim().toUpperCase();
      }
    }

    // Normalize legacy code aliases if present
    if (resolvedDeptCode === 'COM') resolvedDeptCode = 'EIE';
    if (resolvedDeptCode === 'CIV') resolvedDeptCode = 'CEE';
    if (resolvedDeptCode === 'MEC') resolvedDeptCode = 'MME';

    const qb = this.moduleRepo
      .createQueryBuilder('mod')
      .leftJoinAndSelect('mod.department', 'dept')
      .where('mod.isActive = :active', { active: true });

    const semNum = semester ? Number(semester) : null;

    if (semNum && semNum >= 1 && semNum <= 8) {
      qb.andWhere('mod.semester = :semester', { semester: semNum });
    }

    if (semNum === 1 || semNum === 2) {
      // First 2 semesters: Common modules from all departments except MENA
      if (resolvedDeptCode) {
        // Lecturer's department + IS modules
        const prefixes = this.getPrefixesForDepartment(resolvedDeptCode);
        qb.andWhere('(mod.prefix IN (:...prefixes) OR mod.prefix = :isPrefix)', {
          prefixes,
          isPrefix: 'IS',
        });
      } else {
        // General common view: exclude MENA (MN)
        qb.andWhere('mod.prefix != :menaPrefix', { menaPrefix: 'MN' });
      }
    } else if (semNum && semNum >= 3 && semNum <= 8) {
      // Semesters 3-8: Department specialization + IS common modules
      if (resolvedDeptCode) {
        const prefixes = this.getPrefixesForDepartment(resolvedDeptCode);
        qb.andWhere('(mod.prefix IN (:...prefixes) OR mod.prefix = :isPrefix)', {
          prefixes,
          isPrefix: 'IS',
        });
      }
    } else if (resolvedDeptCode) {
      // No semester specified, filter by department + IS
      const prefixes = this.getPrefixesForDepartment(resolvedDeptCode);
      qb.andWhere('(mod.prefix IN (:...prefixes) OR mod.prefix = :isPrefix)', {
        prefixes,
        isPrefix: 'IS',
      });
    }

    qb.orderBy('mod.semester', 'ASC').addOrderBy('mod.code', 'ASC');

    const modules = await qb.getMany();

    return modules.map((m) => ({
      code: m.code,
      title: m.name,
      departmentCode: m.department?.code || m.prefix,
      semester: m.semester,
      credits: m.credits,
    }));
  }

  /**
   * Get single course module by ID.
   */
  async getModuleById(id: string): Promise<CourseModule> {
    const module = await this.moduleRepo.findOne({
      where: { id },
      relations: ['department'],
    });

    if (!module) {
      throw new NotFoundException(`CourseModule with ID "${id}" not found`);
    }

    return module;
  }

  /**
   * Create a new course module under an academic department.
   */
  async createModule(dto: CreateCourseModuleDto): Promise<CourseModule> {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.moduleRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Course module with code "${code}" already exists`);
    }

    const department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
    if (!department) {
      throw new BadRequestException(`Department with ID "${dto.departmentId}" not found`);
    }

    const parsed = parseModuleCode(code);
    const prefix = dto.prefix?.trim().toUpperCase() || parsed?.prefix || code.substring(0, 2);
    const semester = dto.semester ?? parsed?.semester ?? 1;
    const credits = dto.credits ?? parsed?.credits ?? 3;

    const module = this.moduleRepo.create({
      code,
      name: dto.name.trim(),
      prefix,
      semester,
      credits,
      departmentId: dto.departmentId,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const saved = await this.moduleRepo.save(module);
    return this.getModuleById(saved.id);
  }

  /**
   * Update an existing course module.
   */
  async updateModule(id: string, dto: UpdateCourseModuleDto): Promise<CourseModule> {
    const module = await this.getModuleById(id);

    if (dto.departmentId) {
      const dept = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
      if (!dept) {
        throw new BadRequestException(`Department with ID "${dto.departmentId}" not found`);
      }
      module.departmentId = dto.departmentId;
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== module.code) {
        const existing = await this.moduleRepo.findOne({ where: { code } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Course module code "${code}" is already in use`);
        }
        module.code = code;
        const parsed = parseModuleCode(code);
        if (parsed) {
          module.prefix = parsed.prefix;
          if (dto.semester === undefined) module.semester = parsed.semester;
          if (dto.credits === undefined) module.credits = parsed.credits;
        }
      }
    }

    if (dto.name) {
      module.name = dto.name.trim();
    }
    if (dto.semester !== undefined) {
      module.semester = dto.semester;
    }
    if (dto.credits !== undefined) {
      module.credits = dto.credits;
    }
    if (dto.isActive !== undefined) {
      module.isActive = dto.isActive;
    }

    await this.moduleRepo.save(module);
    return this.getModuleById(id);
  }

  /**
   * Soft-delete/deactivate a course module.
   */
  async deleteModule(id: string): Promise<{ message: string }> {
    const module = await this.getModuleById(id);
    module.isActive = false;
    await this.moduleRepo.save(module);
    return { message: `Course module "${module.code}" deactivated successfully` };
  }

  /**
   * Map academic department code to its associated module prefixes:
   * - CEE -> ['CE']
   * - EIE -> ['EE', 'EC'] (Both Electrical & Computer Engineering)
   * - MME -> ['ME']
   * - MENA -> ['MN']
   * - IS -> ['IS']
   */
  private getPrefixesForDepartment(deptCode: string): string[] {
    switch (deptCode) {
      case 'CEE':
      case 'CIV':
        return ['CE'];
      case 'EIE':
      case 'COM':
        return ['EE', 'EC'];
      case 'MME':
      case 'MEC':
        return ['ME'];
      case 'MENA':
        return ['MN'];
      case 'IS':
      case 'ENG':
        return ['IS'];
      default:
        return [deptCode];
    }
  }
}
