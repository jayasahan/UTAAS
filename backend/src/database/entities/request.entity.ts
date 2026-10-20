import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { RequestType } from './request-type.entity';
import { WorkflowTemplate } from './workflow-template.entity';
import { RequestStageHistory } from './request-stage-history.entity';
import { AuditEvent } from './audit-event.entity';

export enum RequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RETURNED_FOR_CORRECTION = 'RETURNED_FOR_CORRECTION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SETTLED = 'SETTLED',
}

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 50 })
  trackingNumber: string; // e.g. 'UTR-2026-0001'

  @Column()
  requestTypeId: string;

  @ManyToOne(() => RequestType, (rt) => rt.requests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requestTypeId' })
  requestType: RequestType;

  @Column()
  workflowTemplateId: string;

  @ManyToOne(() => WorkflowTemplate, (wt) => wt.requests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflowTemplateId' })
  workflowTemplate: WorkflowTemplate;

  @Column()
  applicantId: string;

  @ManyToOne(() => User, (user) => user.requests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'applicantId' })
  applicant: User;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.DRAFT,
  })
  status: RequestStatus;

  @Column({ length: 50, default: 'DRAFT' })
  currentStageKey: string;

  @Column({ nullable: true })
  returningOfficerId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'returningOfficerId' })
  returningOfficer: User;

  @Column({ type: 'jsonb', default: {} })
  formData: Record<string, any>;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  totalAmount: number;

  @OneToMany(() => RequestStageHistory, (rsh) => rsh.request)
  stageHistory: RequestStageHistory[];

  @OneToMany(() => AuditEvent, (ae) => ae.request)
  auditEvents: AuditEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
