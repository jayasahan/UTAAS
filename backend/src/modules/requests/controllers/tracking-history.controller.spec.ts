import { Test, TestingModule } from '@nestjs/testing';
import { TrackingHistoryController } from './tracking-history.controller';
import { TrackingHistoryService } from '../services/tracking-history.service';
import { UserRole } from '../../../database/entities/user.entity';

describe('TrackingHistoryController', () => {
  let controller: TrackingHistoryController;
  let mockTrackingService: any;

  const mockUser = {
    id: 'user-1',
    role: UserRole.LECTURER,
  } as any;

  beforeEach(async () => {
    mockTrackingService = {
      getTrackingInfo: jest.fn().mockResolvedValue({ trackingNumber: 'UTR-2026-0001' }),
      getAuditHistory: jest.fn().mockResolvedValue({ events: [] }),
      getMyRequests: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      getPendingQueue: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      getReviewHistory: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, summaryCounts: { approved: 0, returned: 0, rejected: 0 } } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackingHistoryController],
      providers: [
        { provide: TrackingHistoryService, useValue: mockTrackingService },
      ],
    }).compile();

    controller = module.get<TrackingHistoryController>(TrackingHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTrackingInfo', () => {
    it('should call trackingHistoryService.getTrackingInfo', async () => {
      const res = await controller.getTrackingInfo('req-123', mockUser);
      expect(mockTrackingService.getTrackingInfo).toHaveBeenCalledWith('req-123', mockUser);
      expect(res.trackingNumber).toBe('UTR-2026-0001');
    });
  });

  describe('getAuditHistory', () => {
    it('should call trackingHistoryService.getAuditHistory', async () => {
      const res = await controller.getAuditHistory('req-123', mockUser);
      expect(mockTrackingService.getAuditHistory).toHaveBeenCalledWith('req-123', mockUser);
      expect(res.events).toEqual([]);
    });
  });

  describe('getMyRequests', () => {
    it('should call trackingHistoryService.getMyRequests with default pagination', async () => {
      await controller.getMyRequests(mockUser);
      expect(mockTrackingService.getMyRequests).toHaveBeenCalledWith(mockUser, 1, 10);
    });
  });

  describe('getPendingQueue', () => {
    it('should call trackingHistoryService.getPendingQueue with default pagination', async () => {
      await controller.getPendingQueue(mockUser);
      expect(mockTrackingService.getPendingQueue).toHaveBeenCalledWith(mockUser, 1, 10);
    });
  });

  describe('getReviewHistory', () => {
    it('should call trackingHistoryService.getReviewHistory with params', async () => {
      await controller.getReviewHistory(mockUser, 2, 20, 'APPROVED', 'claim');
      expect(mockTrackingService.getReviewHistory).toHaveBeenCalledWith(
        mockUser,
        2,
        20,
        'APPROVED',
        'claim',
      );
    });
  });
});
