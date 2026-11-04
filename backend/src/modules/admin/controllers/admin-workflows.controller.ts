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
import { UserRole } from '../../../database/entities/user.entity';
import {
  AdminWorkflowsService,
  RequestTypeListItem,
  WorkflowTemplateListItem,
} from '../services/admin-workflows.service';
import { RequestType } from '../../../database/entities/request-type.entity';
import { CreateRequestTypeDto } from '../dto/create-request-type.dto';
import { UpdateRequestTypeDto } from '../dto/update-request-type.dto';
import { CreateWorkflowTemplateDto } from '../dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from '../dto/update-workflow-template.dto';

@ApiTags('Admin / Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/workflows')
export class AdminWorkflowsController {
  constructor(private readonly adminWorkflowsService: AdminWorkflowsService) {}

  @Get('request-types')
  @ApiOperation({
    summary: 'List all administrative request types and active template versions (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of request types',
  })
  async getRequestTypes(): Promise<RequestTypeListItem[]> {
    return this.adminWorkflowsService.getRequestTypes();
  }

  @Get('request-types/:id')
  @ApiOperation({
    summary: 'Get request type details and template versions by ID (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request type profile',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Request type not found',
  })
  async getRequestTypeById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RequestType> {
    return this.adminWorkflowsService.getRequestTypeById(id);
  }

  @Post('request-types')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Define a new administrative request type (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Request type created',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Code already exists',
  })
  async createRequestType(
    @Body() dto: CreateRequestTypeDto,
  ): Promise<RequestType> {
    return this.adminWorkflowsService.createRequestType(dto);
  }

  @Patch('request-types/:id')
  @ApiOperation({
    summary: 'Update request type name, description, or active status (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request type updated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Request type not found',
  })
  async updateRequestType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestTypeDto,
  ): Promise<RequestType> {
    return this.adminWorkflowsService.updateRequestType(id, dto);
  }

  @Get('templates')
  @ApiOperation({
    summary: 'List workflow templates with stage configurations and in-flight claim counts (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of workflow templates',
  })
  async getTemplates(
    @Query('requestTypeId') requestTypeId?: string,
  ): Promise<WorkflowTemplateListItem[]> {
    return this.adminWorkflowsService.getTemplates(requestTypeId);
  }

  @Get('templates/:id')
  @ApiOperation({
    summary: 'Get single workflow template configuration and stage order rules by ID (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workflow template details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow template not found',
  })
  async getTemplateById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowTemplateListItem> {
    return this.adminWorkflowsService.getTemplateById(id);
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new workflow template version with verified contiguous stages (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Workflow template version created',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Non-contiguous stage order or missing required roles',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Request type not found',
  })
  async createTemplate(
    @Body() dto: CreateWorkflowTemplateDto,
  ): Promise<WorkflowTemplateListItem> {
    return this.adminWorkflowsService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @ApiOperation({
    summary: 'Update stages or toggle active status of a workflow template (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workflow template updated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workflow template not found',
  })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowTemplateDto,
  ): Promise<WorkflowTemplateListItem> {
    return this.adminWorkflowsService.updateTemplate(id, dto);
  }
}
