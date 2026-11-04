import {
  Controller,
  Get,
  HttpStatus,
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
  AdminDashboardService,
  DashboardMetricsResponse,
} from '../services/admin-dashboard.service';

@ApiTags('Admin / Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Retrieve system-wide administrative dashboard metrics, finances, bottlenecks, and activity (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System dashboard metrics overview',
  })
  async getMetrics(): Promise<DashboardMetricsResponse> {
    return this.adminDashboardService.getMetrics();
  }
}
