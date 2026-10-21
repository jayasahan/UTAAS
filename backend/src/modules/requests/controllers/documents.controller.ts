import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../database/entities/user-role.enum';
import { Request } from '../../../database/entities/request.entity';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@ApiTags('Supporting Documents')
@Controller('requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload Supporting Document (PDF, PNG, JPEG, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: {
          type: 'string',
          enum: ['APPOINTMENT_LETTER', 'EXAM_TIMETABLE', 'ATTENDANCE_MARKS_SHEET'],
        },
        requestId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file format or size exceeds 10MB' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MiB stream-level limit
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Body('category') category?: string,
    @Body('requestId') requestId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file format: ${file.mimetype}. Allowed formats: PDF, PNG, JPEG.`,
      );
    }

    const maxBytes = 10 * 1024 * 1024; // 10 MiB
    if (file.size > maxBytes) {
      throw new BadRequestException('File exceeds maximum size limit of 10 MiB');
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploaderId = user?.id || 'anonymous';
    const storedFilename = `${uploaderId}__${randomUUID()}-${safeName}`;
    const destinationPath = path.join(this.uploadDir, storedFilename);

    await fs.promises.writeFile(destinationPath, file.buffer);

    return {
      name: file.originalname,
      url: `/api/v1/requests/documents/${storedFilename}`,
      documentType: category || 'APPOINTMENT_LETTER',
      size: file.size,
      mimetype: file.mimetype,
      requestId: requestId || null,
    };
  }

  @Get('documents/:filename')
  @ApiOperation({ summary: 'Retrieve Uploaded Supporting Document with Ownership/Role Checks' })
  async getDocument(
    @Param('filename') filename: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Document not found');
    }

    // If user object is missing, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required to access documents');
    }

    // Role-based authorization: Reviewers and Admin roles have authorization to view claim documents
    const isReviewerOrAdmin = user.role !== UserRole.LECTURER;
    if (isReviewerOrAdmin) {
      return res.sendFile(filePath);
    }

    // For LECTURER: Verify that user is the original uploader (encoded in filename)
    if (safeFilename.startsWith(`${user.id}__`)) {
      return res.sendFile(filePath);
    }

    // Check if the document is referenced in any of the lecturer's claims in PostgreSQL
    const claim = await this.requestRepo
      .createQueryBuilder('request')
      .where('request.applicantId = :applicantId', { applicantId: user.id })
      .andWhere("request.formData::text LIKE :docMatch", { docMatch: `%${safeFilename}%` })
      .getOne();

    if (claim) {
      return res.sendFile(filePath);
    }

    throw new ForbiddenException('You do not have permission to access this document');
  }
}
