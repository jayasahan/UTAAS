import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { RequestType } from './request-type.entity';
import { Request } from './request.entity';
import { UserRole } from './user.entity';

export interface WorkflowStageConfig {
  order: number;
  stageKey: string;
  stageName: string;
  requiredRole: UserRole;
  isDepartmentScoped?: boolean;
}

@Entity('workflow_templates')
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestTypeId: string;

  @ManyToOne(() => RequestType, (rt) => rt.workflowTemplates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestTypeId' })
  requestType: RequestType;

  @Column({ default: 1 })
  version: number;

  @Column({ type: 'jsonb' })
  stages: WorkflowStageConfig[];

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Request, (req) => req.workflowTemplate)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
