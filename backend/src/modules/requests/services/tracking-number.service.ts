import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Request } from '../../../database/entities/request.entity';

@Injectable()
export class TrackingNumberService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  async generateTrackingNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `UTR-${currentYear}-`;

    // Find the latest request with prefix for this year
    const latestRequest = await this.requestRepo.findOne({
      where: {
        trackingNumber: Like(`${prefix}%`),
      },
      order: {
        trackingNumber: 'DESC',
      },
    });

    let nextSequence = 1;

    if (latestRequest && latestRequest.trackingNumber) {
      const parts = latestRequest.trackingNumber.split('-');
      if (parts.length === 3) {
        const seqNum = parseInt(parts[2], 10);
        if (!isNaN(seqNum)) {
          nextSequence = seqNum + 1;
        }
      }
    }

    const paddedSequence = String(nextSequence).padStart(4, '0');
    return `${prefix}${paddedSequence}`;
  }
}
