import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import * as fs from 'fs';
import * as path from 'path';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should throw BadRequestException if no file is provided', async () => {
      await expect(controller.uploadFile(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file format is unsupported', async () => {
      const mockFile = {
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      await expect(controller.uploadFile(mockFile)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file exceeds 10MB limit', async () => {
      const mockFile = {
        originalname: 'big_file.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024,
        buffer: Buffer.alloc(10),
      } as Express.Multer.File;

      await expect(controller.uploadFile(mockFile)).rejects.toThrow(BadRequestException);
    });

    it('should successfully save valid PDF and return document metadata', async () => {
      const mockFile = {
        originalname: 'appointment_letter.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('%PDF-1.4 test appointment letter'),
      } as Express.Multer.File;

      const result = await controller.uploadFile(mockFile, 'APPOINTMENT_LETTER', 'req-123');

      expect(result.name).toBe('appointment_letter.pdf');
      expect(result.documentType).toBe('APPOINTMENT_LETTER');
      expect(result.size).toBe(2048);
      expect(result.url).toMatch(/^\/api\/v1\/requests\/documents\//);
      expect(result.requestId).toBe('req-123');
    });
  });

  describe('getDocument', () => {
    it('should throw NotFoundException if document does not exist', async () => {
      const mockRes = {
        sendFile: jest.fn(),
      } as any;

      await expect(controller.getDocument('non-existent-uuid.pdf', mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
