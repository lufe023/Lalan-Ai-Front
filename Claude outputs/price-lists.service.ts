import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.priceList.findMany({
      where: { tenantId },
      include: { rules: true, _count: { select: { clients: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const list = await this.prisma.priceList.findFirst({
      where: { id, tenantId },
      include: { rules: true, clients: { select: { id: true, name: true, phone: true } } },
    });
    if (!list) throw new NotFoundException('Price list not found');
    return list;
  }

  async create(tenantId: string, dto: CreatePriceListDto) {
    this.validateRules(dto.rules ?? []);

    // Only one pricelist can be default — clear others first if this one is default
    if (dto.isDefault) {
      await this.prisma.priceList.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const id = uuidv7();
    return this.prisma.priceList.create({
      data: {
        id,
        tenantId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        rules: {
          create: (dto.rules ?? []).map(r => ({
            id: uuidv7(),
            target: r.target,
            serviceCategoryKey: r.serviceCategoryKey,
            productCategoryKey: r.productCategoryKey,
            serviceId: r.serviceId,
            productId: r.productId,
            fixedPrice: r.fixedPrice,
            discountPercent: r.discountPercent,
            priceMultiplier: r.priceMultiplier,
          })),
        },
      },
      include: { rules: true },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreatePriceListDto>) {
    await this.findOne(tenantId, id); // throws if not found
    this.validateRules(dto.rules ?? []);

    if (dto.isDefault) {
      await this.prisma.priceList.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    // Replace rules atomically
    return this.prisma.$transaction(async (tx) => {
      if (dto.rules !== undefined) {
        await tx.priceListRule.deleteMany({ where: { priceListId: id } });
      }
      return tx.priceList.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          isDefault: dto.isDefault,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          ...(dto.rules !== undefined && {
            rules: {
              create: dto.rules.map(r => ({
                id: uuidv7(),
                target: r.target,
                serviceCategoryKey: r.serviceCategoryKey,
                productCategoryKey: r.productCategoryKey,
                serviceId: r.serviceId,
                productId: r.productId,
                fixedPrice: r.fixedPrice,
                discountPercent: r.discountPercent,
                priceMultiplier: r.priceMultiplier,
              })),
            },
          }),
        },
        include: { rules: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.priceList.delete({ where: { id } });
  }

  /** Assign a pricelist to a client */
  async assignToClient(tenantId: string, priceListId: string, clientId: string) {
    // Verify pricelist belongs to tenant
    await this.findOne(tenantId, priceListId);
    await this.prisma.client.findFirstOrThrow({ where: { id: clientId, tenantId } });
    await this.prisma.client.update({ where: { id: clientId }, data: { priceListId } });
    return { assigned: true };
  }

  /** Remove pricelist assignment from a client */
  async unassignFromClient(tenantId: string, clientId: string) {
    await this.prisma.client.update({ where: { id: clientId }, data: { priceListId: null } });
    return { unassigned: true };
  }

  /**
   * Compute the effective price for a given base price, given:
   * - the client's assigned pricelist (or the default pricelist)
   * - service/product context for category matching
   */
  async computeEffectivePrice(params: {
    tenantId: string;
    clientId?: string;
    basePrice: number;
    serviceId?: string;
    productId?: string;
    serviceCategoryKey?: string;
    productCategoryKey?: string;
  }): Promise<{ effectivePrice: number; rule?: string }> {
    const { tenantId, clientId, basePrice } = params;

    // Get client's pricelist, or the default
    let priceListId: string | null = null;
    if (clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: clientId, tenantId }, select: { priceListId: true } });
      priceListId = client?.priceListId ?? null;
    }
    if (!priceListId) {
      const defaultList = await this.prisma.priceList.findFirst({ where: { tenantId, isDefault: true, active: true } });
      priceListId = defaultList?.id ?? null;
    }

    if (!priceListId) return { effectivePrice: basePrice };

    const priceList = await this.prisma.priceList.findFirst({
      where: { id: priceListId, active: true },
      include: { rules: true },
    });
    if (!priceList) return { effectivePrice: basePrice };

    // Priority: specific_service/product > category
    const { serviceId, productId, serviceCategoryKey, productCategoryKey } = params;
    let matchedRule = priceList.rules.find(r =>
      (r.target === 'specific_service' && serviceId && r.serviceId === serviceId) ||
      (r.target === 'specific_product' && productId && r.productId === productId)
    ) ?? priceList.rules.find(r =>
      (r.target === 'service_category' && serviceCategoryKey && r.serviceCategoryKey === serviceCategoryKey) ||
      (r.target === 'product_category' && productCategoryKey && r.productCategoryKey === productCategoryKey)
    );

    if (!matchedRule) return { effectivePrice: basePrice };

    let effectivePrice = basePrice;
    if (matchedRule.fixedPrice !== null && matchedRule.fixedPrice !== undefined)
      effectivePrice = Number(matchedRule.fixedPrice);
    else if (matchedRule.discountPercent !== null && matchedRule.discountPercent !== undefined)
      effectivePrice = basePrice * (1 - Number(matchedRule.discountPercent) / 100);
    else if (matchedRule.priceMultiplier !== null && matchedRule.priceMultiplier !== undefined)
      effectivePrice = basePrice * Number(matchedRule.priceMultiplier);

    return {
      effectivePrice: Math.round(effectivePrice * 100) / 100, // round to 2 decimals
      rule: matchedRule.target,
    };
  }

  private validateRules(rules: any[]) {
    for (const r of rules) {
      const modifiers = [r.fixedPrice, r.discountPercent, r.priceMultiplier].filter(v => v !== undefined && v !== null);
      if (modifiers.length === 0) throw new BadRequestException('Each rule must have exactly one of fixedPrice, discountPercent, or priceMultiplier');
      if (modifiers.length > 1) throw new BadRequestException('Each rule must have only one price modifier (fixedPrice, discountPercent, or priceMultiplier)');
    }
  }
}
