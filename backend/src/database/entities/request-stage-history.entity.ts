import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Request } from './request.entity';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';

export enum StageAction {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECT_RETURN = 'REJECT_RETURN',
  APPROVE_PAYOUT = 'APPROVE_PAYOUT',
  DIRECT_QUERY = 'DIRECT_QUERY',
  RESUBMITTED = 'RESUBMITTED',
}

@Entity('request_stage_history')
export class RequestStageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @ManyToOne(() => Request, (req) => req.stageHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: Request;

  @Column({ length: 50 })
  stageKey: string;

  @Column({ length: 100 })
  stageName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  requiredRole: UserRole;

  @Column({ type: 'int' })
  stageOrder: number;

  @Column({ nullable: true })
  actorId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @Column({
    type: 'enum',
    enum: StageAction,
    default: StageAction.PENDING,
  })
  action: StageAction;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  enteredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
