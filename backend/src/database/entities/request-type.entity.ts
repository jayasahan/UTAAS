import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkflowTemplate } from './workflow-template.entity';
import { Request } from './request.entity';

@Entity('request_types')
export class RequestType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string; // e.g. 'PAPER_MARKING', 'GENERAL_REIMBURSEMENT'

  @Column({ length: 150 })
  name: string; // e.g. 'Paper Setting, Marking & Assessment Payment Claim'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => WorkflowTemplate, (wt) => wt.requestType)
  workflowTemplates: WorkflowTemplate[];

  @OneToMany(() => Request, (req) => req.requestType)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
