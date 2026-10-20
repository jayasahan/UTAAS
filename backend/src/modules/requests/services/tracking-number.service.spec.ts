import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrackingNumberService } from './tracking-number.service';
import { Request } from '../../../database/entities/request.entity';

describe('TrackingNumberService', () => {
  let service: TrackingNumberService;
  let mockRequestRepo: any;

  beforeEach(async () => {
    mockRequestRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingNumberService,
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
      ],
    }).compile();

    service = module.get<TrackingNumberService>(TrackingNumberService);
  });

  it('should generate UTR-YYYY-0001 when no requests exist yet', async () => {
    mockRequestRepo.findOne.mockResolvedValue(null);

    const year = new Date().getFullYear();
    const trackingNumber = await service.generateTrackingNumber();

    expect(trackingNumber).toBe(`UTR-${year}-0001`);
  });

  it('should increment existing sequence number', async () => {
    const year = new Date().getFullYear();
    mockRequestRepo.findOne.mockResolvedValue({
      trackingNumber: `UTR-${year}-0042`,
    });

    const trackingNumber = await service.generateTrackingNumber();

    expect(trackingNumber).toBe(`UTR-${year}-0043`);
  });
});
