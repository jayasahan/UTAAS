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
import { User } from './user.entity';

export interface HodProportionDivisionRecord {
  essayWeightPercent: number;
  mcqWeightPercent: number;
  comments?: string;
  setByHodId: string;
  setByHodName: string;
  setAt: Date;
  status: 'AWAITING_LECTURER_CONSENSUS' | 'DISAGREED_RETURNED_TO_HOD' | 'CONSENSUS_REACHED';
  responses: {
    lecturerId: string;
    lecturerName: string;
    agreed: boolean;
    comments?: string;
    respondedAt: Date;
  }[];
}

export interface StructureChangeHistoryRecord {
  changedById: string;
  changedByName: string;
  previousTotalQuestions: number;
  newTotalQuestions: number;
  reason: string;
  changedAt: Date;
}

@Entity('exam_paper_structures')
@Index(['courseCode', 'academicYear', 'semester', 'examType'], { unique: true })
export class ExamPaperStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  courseCode: string; // e.g. 'EC5060', 'IS5302'

  @Column({ length: 200, nullable: true })
  courseTitle: string; // e.g. 'Software Engineering'

  @Column({ length: 50 })
  academicYear: string; // e.g. '2023/2024'

  @Column({ length: 50 })
  semester: string; // e.g. 'Semester 1' or '5'

  @Column({ length: 100 })
  examType: string; // e.g. 'End Semester Examination'

  @Column({ length: 50, default: 'ESSAY' })
  paperType: string; // 'ESSAY', 'MCQ', 'COMBINED'

  @Column({ type: 'int', default: 3 })
  paperDurationHours: number; // e.g. 1, 2, 3, 4

  @Column({ type: 'int', default: 5 })
  totalQuestions: number; // e.g. 5 essay questions

  @Column({ type: 'int', default: 0 })
  totalMcqQuestions: number; // e.g. 30 MCQ questions

  @Column({ type: 'int', default: 0 })
  totalCandidates: number; // e.g. 120 candidates who sat the exam

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100.0 })
  essayWeightPercent: number; // e.g. 75% for combined

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  mcqWeightPercent: number; // e.g. 25% for combined

  @Column({ nullable: true })
  registeredById: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registeredById' })
  registeredBy: User;

  @Column({ length: 150 })
  registeredByName: string; // e.g. 'Dr. Hansana H.A.J.'

  @Column({ length: 150 })
  registeredByEmail: string; // e.g. 'lecturer@eng.ruh.ac.lk'

  @Column({ type: 'jsonb', nullable: true })
  hodProportionDivision?: HodProportionDivisionRecord | null;

  @Column({ type: 'jsonb', nullable: true })
  structureChangeHistory?: StructureChangeHistoryRecord[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
