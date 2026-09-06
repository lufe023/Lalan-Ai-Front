import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PriceListsService } from './price-lists.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';

@ApiTags('Price Lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('price-lists')
export class PriceListsController {
  constructor(private readonly svc: PriceListsService) {}

  @Get()
  @ApiOperation({ summary: 'List all price lists for the current tenant' })
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single price list with its rules and assigned clients' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new price list with rules' })
  create(@Req() req: any, @Body() dto: CreatePriceListDto) {
    return this.svc.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a price list and replace its rules' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreatePriceListDto>) {
    return this.svc.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a price list' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.tenantId, id);
  }

  @Post(':id/assign/:clientId')
  @ApiOperation({ summary: 'Assign this price list to a specific client (VIP override)' })
  assignToClient(
    @Req() req: any,
    @Param('id') priceListId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.svc.assignToClient(req.user.tenantId, priceListId, clientId);
  }

  @Delete('unassign/:clientId')
  @ApiOperation({ summary: 'Remove price list override from a client (reverts to default)' })
  unassignFromClient(@Req() req: any, @Param('clientId') clientId: string) {
    return this.svc.unassignFromClient(req.user.tenantId, clientId);
  }

  @Post('compute-price')
  @ApiOperation({ summary: 'Compute effective price for a service/product given a client\'s pricelist' })
  computeEffectivePrice(@Req() req: any, @Body() body: {
    clientId?: string;
    basePrice: number;
    serviceId?: string;
    productId?: string;
    serviceCategoryKey?: string;
    productCategoryKey?: string;
  }) {
    return this.svc.computeEffectivePrice({ tenantId: req.user.tenantId, ...body });
  }
}
