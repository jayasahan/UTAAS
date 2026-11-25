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
import { UserRole } from './user-role.enum';

export { UserRole };

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

  @Column({ nullable: true, select: false })
  passwordHash?: string | null;

  @Column({ default: 0 })
  tokenVersion?: number;

  @Column({ nullable: true, length: 150 })
  designation?: string | null;

  @Column({ nullable: true, length: 50 })
  staffId?: string | null;

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
