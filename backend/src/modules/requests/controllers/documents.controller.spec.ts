import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../database/entities/user-role.enum';
import * as fs from 'fs';
import * as path from 'path';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let mockRequestRepo: any;

  const mockLecturer: User = {
    id: 'user-lecturer-1',
    email: 'lecturer1@eng.ruh.ac.lk',
    role: UserRole.LECTURER,
  } as User;

  const mockOtherLecturer: User = {
    id: 'user-lecturer-2',
    email: 'lecturer2@eng.ruh.ac.lk',
    role: UserRole.LECTURER,
  } as User;

  const mockHod: User = {
    id: 'user-hod-1',
    email: 'hod@eng.ruh.ac.lk',
    role: UserRole.HOD,
    departmentId: 'dept-com-1',
  } as User;

  beforeEach(async () => {
    mockRequestRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: getRepositoryToken(Request),
          useValue: mockRequestRepo,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should throw BadRequestException if no file is provided', async () => {
      await expect(controller.uploadFile(null as any, mockLecturer)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file format is unsupported', async () => {
      const mockFile = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      await expect(controller.uploadFile(mockFile, mockLecturer)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file exceeds 10MB limit', async () => {
      const mockFile = {
        originalname: 'big_file.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024,
        buffer: Buffer.alloc(10),
      } as Express.Multer.File;

      await expect(controller.uploadFile(mockFile, mockLecturer)).rejects.toThrow(BadRequestException);
    });

    it('should successfully save valid PDF and return document metadata with uploader prefix', async () => {
      const mockFile = {
        originalname: 'appointment_letter.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('%PDF-1.4 test appointment letter'),
      } as Express.Multer.File;

      const result = await controller.uploadFile(mockFile, mockLecturer, 'APPOINTMENT_LETTER', 'req-123');

      expect(result.name).toBe('appointment_letter.pdf');
      expect(result.documentType).toBe('APPOINTMENT_LETTER');
      expect(result.size).toBe(2048);
      expect(result.url).toMatch(/^\/api\/v1\/requests\/documents\/user-lecturer-1__/);
      expect(result.requestId).toBe('req-123');
    });
  });

  describe('getDocument', () => {
    it('should throw NotFoundException if document does not exist', async () => {
      const mockRes = {
        sendFile: jest.fn(),
      } as any;

      await expect(controller.getDocument('non-existent-uuid.pdf', mockLecturer, mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow original uploader to download their document', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      const testFilename = `${mockLecturer.id}__test-access.pdf`;
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'dummy-content');

      const mockRes = {
        sendFile: jest.fn().mockReturnValue(true),
      } as any;

      try {
        await controller.getDocument(testFilename, mockLecturer, mockRes);
        expect(mockRes.sendFile).toHaveBeenCalledWith(testFilePath);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should allow reviewer (e.g. HOD) to access claim document when authorized for department and stage', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      const testFilename = `${mockLecturer.id}__test-hod.pdf`;
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'dummy-content');

      mockRequestRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'claim-1',
          applicantId: mockLecturer.id,
          applicant: { id: mockLecturer.id, departmentId: 'dept-com-1' },
          status: RequestStatus.UNDER_REVIEW,
          currentStageKey: 'HEAD_OF_DEPARTMENT',
          stageHistory: [
            { stageKey: 'HEAD_OF_DEPARTMENT', requiredRole: UserRole.HOD, enteredAt: new Date() },
          ],
        }),
      });

      const mockRes = {
        sendFile: jest.fn().mockReturnValue(true),
      } as any;

      try {
        await controller.getDocument(testFilename, mockHod, mockRes);
        expect(mockRes.sendFile).toHaveBeenCalledWith(testFilePath);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should throw ForbiddenException if reviewer attempts to access document for a claim outside their department', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      const testFilename = `${mockLecturer.id}__other-dept.pdf`;
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'dummy-content');

      mockRequestRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'claim-2',
          applicantId: mockLecturer.id,
          applicant: { id: mockLecturer.id, departmentId: 'dept-civ-2' },
          status: RequestStatus.UNDER_REVIEW,
          currentStageKey: 'HEAD_OF_DEPARTMENT',
        }),
      });

      const mockRes = { sendFile: jest.fn() } as any;

      try {
        await expect(controller.getDocument(testFilename, mockHod, mockRes)).rejects.toThrow(
          ForbiddenException,
        );
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should throw ForbiddenException if reviewer attempts to access document of a draft claim', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      const testFilename = `${mockLecturer.id}__draft-doc.pdf`;
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'dummy-content');

      mockRequestRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'claim-draft',
          applicantId: mockLecturer.id,
          applicant: { id: mockLecturer.id, departmentId: 'dept-com-1' },
          status: RequestStatus.DRAFT,
        }),
      });

      const mockRes = { sendFile: jest.fn() } as any;

      try {
        await expect(controller.getDocument(testFilename, mockHod, mockRes)).rejects.toThrow(
          ForbiddenException,
        );
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should throw ForbiddenException if another lecturer attempts to access document without claim permission', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      const testFilename = `${mockLecturer.id}__secret.pdf`;
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'dummy-content');

      const mockRes = {
        sendFile: jest.fn(),
      } as any;

      try {
        await expect(controller.getDocument(testFilename, mockOtherLecturer, mockRes)).rejects.toThrow(
          ForbiddenException,
        );
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
