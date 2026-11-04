import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { User, UserRole } from '../../../database/entities/user.entity';
import {
  AdminDepartmentsService,
  DepartmentDetailItem,
  PaginatedDepartmentsResponse,
} from '../services/admin-departments.service';
import { DepartmentQueryDto } from '../dto/department-query.dto';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@ApiTags('Admin / Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/departments')
export class AdminDepartmentsController {
  constructor(private readonly adminDepartmentsService: AdminDepartmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List academic departments with HOD details, staff counts, and pending review counts (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated department list',
  })
  async getDepartments(
    @Query() query: DepartmentQueryDto,
  ): Promise<PaginatedDepartmentsResponse> {
    return this.adminDepartmentsService.getDepartments(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get department details, current HOD, and claim statistics by ID (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Department profile',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Department not found',
  })
  async getDepartmentById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DepartmentDetailItem> {
    return this.adminDepartmentsService.getDepartmentById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new academic department with optional HOD appointment (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Department created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Department code already exists',
  })
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentDetailItem> {
    return this.adminDepartmentsService.createDepartment(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update department name, code, or assign/replace Head of Department (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Department updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Department not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Department code already in use',
  })
  async updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDetailItem> {
    return this.adminDepartmentsService.updateDepartment(id, dto);
  }

  @Get(':id/staff')
  @ApiOperation({
    summary: 'List all academic staff members affiliated with this department (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Department staff list',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Department not found',
  })
  async getDepartmentStaff(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<User[]> {
    return this.adminDepartmentsService.getDepartmentStaff(id);
  }
}
