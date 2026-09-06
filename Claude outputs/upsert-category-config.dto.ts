import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertCategoryConfigDto {
  @ApiProperty({ enum: ['service', 'product'], description: 'Whether this config is for a service or product category' })
  @IsIn(['service', 'product'])
  type: 'service' | 'product';

  @ApiProperty({ example: 'nails', description: 'The category enum value key' })
  @IsString()
  categoryKey: string;

  @ApiPropertyOptional({ example: 'Nail Art Premium', description: 'Display name override' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: '💅' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#f9a8d4' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 10, description: 'Default discount % for this category (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
