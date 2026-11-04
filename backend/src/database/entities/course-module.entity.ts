import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('course_modules')
export class CourseModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 20 })
  code: string; // e.g. 'IS5302', 'EC5060', 'CE3010', 'EE3010', 'ME3010', 'MN3010'

  @Column({ length: 200 })
  name: string; // e.g. 'Operations Research & Quantitative Methods'

  @Column({ length: 10 })
  prefix: string; // 'IS', 'EC', 'EE', 'CE', 'ME', 'MN'

  @Column({ type: 'int' })
  semester: number; // 1 to 8

  @Column({ type: 'int', default: 3 })
  credits: number; // e.g. 1, 2, 3, 4, 6

  @Column({ nullable: true })
  departmentId: string;

  @ManyToOne(() => Department, (dept) => dept.courseModules, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
