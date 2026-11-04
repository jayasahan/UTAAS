import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  AdminAuditService,
  PaginatedAuditLogsResponse,
} from '../services/admin-audit.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditEvent } from '../../../database/entities/audit-event.entity';

@ApiTags('Admin / Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query immutable system audit log trail with pagination and filters (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated audit events list',
  })
  async getAuditLogs(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedAuditLogsResponse> {
    return this.adminAuditService.getAuditLogs(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single audit event details with field diff and claim context by ID (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit event profile',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Audit event not found',
  })
  async getAuditLogById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditEvent> {
    return this.adminAuditService.getAuditLogById(id);
  }
}
