import {
  IsString, IsOptional, IsBoolean, IsDateString,
  IsArray, ValidateNested, IsNumber, Min, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceListRuleDto {
  @ApiProperty({
    enum: ['service_category', 'product_category', 'specific_service', 'specific_product'],
    description: 'What this rule targets',
  })
  @IsIn(['service_category', 'product_category', 'specific_service', 'specific_product'])
  target: string;

  @ApiPropertyOptional({ example: 'nails', description: 'ServiceCategory key — required when target=service_category' })
  @IsOptional()
  @IsString()
  serviceCategoryKey?: string;

  @ApiPropertyOptional({ example: 'nailcare', description: 'ProductCategory key — required when target=product_category' })
  @IsOptional()
  @IsString()
  productCategoryKey?: string;

  @ApiPropertyOptional({ description: 'Service UUID — required when target=specific_service' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Product UUID — required when target=specific_product' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ example: 25.00, description: 'Absolute fixed price override (mutually exclusive with discount/multiplier)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedPrice?: number;

  @ApiPropertyOptional({ example: 15, description: 'Percentage discount (0–100). e.g. 15 = 15% off base price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 0.85, description: 'Price multiplier. e.g. 0.85 = 15% off; 1.10 = 10% surcharge' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMultiplier?: number;
}

export class CreatePriceListDto {
  @ApiProperty({ example: 'Lista VIP Clientes Frecuentes' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false, description: 'If true, applies to clients without an explicit pricelist assigned' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601 date), e.g. for seasonal promotions' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601 date)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [CreatePriceListRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePriceListRuleDto)
  rules?: CreatePriceListRuleDto[];
}
