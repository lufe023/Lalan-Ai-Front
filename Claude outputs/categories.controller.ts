import { Controller, Get, Post, Body, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { UpsertCategoryConfigDto } from './dto/upsert-category-config.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all category configs for the current tenant' })
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a category config (upsert by type+categoryKey)' })
  upsert(@Req() req: any, @Body() dto: UpsertCategoryConfigDto) {
    return this.svc.upsert(req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category config (resets to system defaults)' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.tenantId, id);
  }
}
