import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LecturerProportionConsensusDto {
  @ApiProperty({ example: 'EC5060', description: 'Course code' })
  @IsString()
  @IsNotEmpty()
  courseCode: string;

  @ApiProperty({ example: '2023/2024', description: 'Academic year' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 'Semester 1', description: 'Semester' })
  @IsString()
  @IsNotEmpty()
  semester: string;

  @ApiProperty({ example: 'End Semester Examination', description: 'Examination type' })
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiProperty({
    example: true,
    description: 'True if lecturer agrees with HOD proportion division; False if lecturer disagrees',
  })
  @IsBoolean()
  agreed: boolean;

  @ApiPropertyOptional({
    example: 'Agreed with 60/40 proportion distribution',
    description: 'Comments (Mandatory if agreed is false, explaining why to the HOD)',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}
