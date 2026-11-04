import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateRequestTypeDto {
  @ApiPropertyOptional({ example: 'Paper Setting & Assessment Remuneration' })
  @IsOptional()
  @IsString()
  @Length(3, 150, { message: 'Name must be between 3 and 150 characters' })
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Active status flag' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
