import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCategoryConfigDto } from './dto/upsert-category-config.dto';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all category configs for a tenant */
  async findAll(tenantId: string) {
    return this.prisma.categoryConfig.findMany({
      where: { tenantId },
      orderBy: [{ type: 'asc' }, { categoryKey: 'asc' }],
    });
  }

  /** Upsert (create or update) a category config for a given type+key */
  async upsert(tenantId: string, dto: UpsertCategoryConfigDto) {
    const existing = await this.prisma.categoryConfig.findUnique({
      where: { tenantId_type_categoryKey: { tenantId, type: dto.type, categoryKey: dto.categoryKey } },
    });

    if (existing) {
      return this.prisma.categoryConfig.update({
        where: { id: existing.id },
        data: {
          displayName: dto.displayName,
          icon: dto.icon,
          color: dto.color,
          discountPercent: dto.discountPercent,
          description: dto.description,
          active: dto.active ?? true,
        },
      });
    }

    return this.prisma.categoryConfig.create({
      data: {
        id: uuidv7(),
        tenantId,
        type: dto.type,
        categoryKey: dto.categoryKey,
        displayName: dto.displayName,
        icon: dto.icon,
        color: dto.color,
        discountPercent: dto.discountPercent ?? 0,
        description: dto.description,
        active: dto.active ?? true,
      },
    });
  }

  /** Get a single category config by type+key */
  async findOne(tenantId: string, type: string, categoryKey: string) {
    const config = await this.prisma.categoryConfig.findUnique({
      where: { tenantId_type_categoryKey: { tenantId, type, categoryKey } },
    });
    if (!config) throw new NotFoundException(`Category config not found for ${type}/${categoryKey}`);
    return config;
  }

  /** Delete a category config (resets to system defaults) */
  async remove(tenantId: string, id: string) {
    await this.prisma.categoryConfig.findFirstOrThrow({ where: { id, tenantId } });
    await this.prisma.categoryConfig.delete({ where: { id } });
  }
}
