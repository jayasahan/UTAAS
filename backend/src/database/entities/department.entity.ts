import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { CourseModule } from './course-module.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  code: string; // e.g. 'CEE', 'MME', 'EIE', 'IS', 'MENA'

  @Column({ length: 150 })
  name: string; // e.g. 'Department of Civil and Environmental Engineering'

  @OneToMany(() => User, (user) => user.department)
  users?: User[];

  @OneToMany(() => CourseModule, (cm) => cm.department)
  courseModules?: CourseModule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
