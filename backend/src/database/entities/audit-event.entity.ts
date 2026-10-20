import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Request } from './request.entity';

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requestId: string;

  @ManyToOne(() => Request, (req) => req.auditEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: Request;

  @Column({ nullable: true })
  actorId: string;

  @Column({ length: 150 })
  actorName: string;

  @Column({ length: 50 })
  actorRole: string;

  @Column({ length: 50 })
  actionType: string; // e.g. 'SUBMIT', 'APPROVE', 'REJECT_RETURN', 'APPROVE_PAYOUT', 'DIRECT_QUERY', 'RESUBMIT', 'EDIT'

  @Column({ length: 50, nullable: true })
  previousStatus: string;

  @Column({ length: 50 })
  newStatus: string;

  @Column({ type: 'jsonb', nullable: true })
  fieldDiff: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Index()
  @CreateDateColumn({ update: false })
  createdAt: Date;
}
