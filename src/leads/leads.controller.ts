import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadsService } from "./leads.service";

@ApiTags("Leads")
@ApiBearerAuth()
@Controller("businesses/:businessId/leads")
export class LeadsController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(LeadsService) private readonly leadsService: LeadsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.leadsService.listByBusiness(businessId);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: CreateLeadDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    const [lead] = await this.leadsService.create(businessId, dto);
    return lead;
  }
}
