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
import { Department } from './department.entity';
import { Request } from './request.entity';

export enum UserRole {
  LECTURER = 'LECTURER',
  HOD = 'HOD',
  DEAN = 'DEAN',
  EXAMINATION_OFFICER = 'EXAMINATION_OFFICER',
  FINANCIAL_OFFICER = 'FINANCIAL_OFFICER',
  ASSISTANT_BURSAR = 'ASSISTANT_BURSAR',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 150 })
  fullName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.LECTURER,
  })
  role: UserRole;

  @Column({ nullable: true })
  departmentId: string;

  @ManyToOne(() => Department, (dept) => dept.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Request, (request) => request.applicant)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
