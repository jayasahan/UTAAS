import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '../../../database/entities/user.entity';
import {
  AdminModulesService,
  PaginatedModulesResponse,
} from '../services/admin-modules.service';
import { CourseModule } from '../../../database/entities/course-module.entity';
import { CreateCourseModuleDto } from '../dto/create-course-module.dto';
import { UpdateCourseModuleDto } from '../dto/update-course-module.dto';
import { CourseModuleQueryDto } from '../dto/course-module-query.dto';

@ApiTags('Admin / Course Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/modules')
export class AdminModulesController {
  constructor(private readonly adminModulesService: AdminModulesService) {}

  @Get()
  @ApiOperation({
    summary: 'List course modules with department, semester, and search filters (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated course module list',
  })
  async getModules(
    @Query() query: CourseModuleQueryDto,
  ): Promise<PaginatedModulesResponse> {
    return this.adminModulesService.getModules(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get course module details by ID (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course module details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async getModuleById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseModule> {
    return this.adminModulesService.getModuleById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a new course module to an academic department (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Course module created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Module code already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Department not found',
  })
  async createModule(
    @Body() dto: CreateCourseModuleDto,
  ): Promise<CourseModule> {
    return this.adminModulesService.createModule(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update course module name, code, credits, semester, or active status (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course module updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'New module code is already in use',
  })
  async updateModule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseModuleDto,
  ): Promise<CourseModule> {
    return this.adminModulesService.updateModule(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate/archive a course module from active curriculum (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module deactivated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async deleteModule(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.adminModulesService.deleteModule(id);
  }
}
