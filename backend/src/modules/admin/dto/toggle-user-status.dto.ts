import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleUserStatusDto {
  @ApiProperty({ example: false, description: 'Active status flag (true = active, false = deactivated)' })
  @IsBoolean()
  @IsNotEmpty({ message: 'isActive flag is required' })
  isActive: boolean;
}
