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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../../database/entities/user.entity';
import { AdminUsersService, PaginatedUsersResponse } from '../services/admin-users.service';
import { AdminUserQueryDto } from '../dto/admin-user-query.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { ToggleUserStatusDto } from '../dto/toggle-user-status.dto';

@ApiTags('Admin / Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users with pagination, fuzzy search, and filters (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated user directory listing',
  })
  async getUsers(@Query() query: AdminUserQueryDto): Promise<PaginatedUsersResponse> {
    return this.adminUsersService.getUsers(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single user details by ID with department and request count (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<User & { requestsCount: number }> {
    return this.adminUsersService.getUserById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register and create a new staff member or administrator (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or missing department',
  })
  async createUser(
    @Body() dto: CreateAdminUserDto,
  ): Promise<User & { requestsCount: number }> {
    return this.adminUsersService.createUser(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user profile, role, department, or reset password (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<User & { requestsCount: number }> {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a user account with session invalidation (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Self-deactivation or deactivation of the last admin prevented',
  })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleUserStatusDto,
    @CurrentUser() admin: User,
  ): Promise<{ message: string; user: User & { requestsCount: number } }> {
    return this.adminUsersService.toggleUserStatus(id, dto, admin);
  }
}
