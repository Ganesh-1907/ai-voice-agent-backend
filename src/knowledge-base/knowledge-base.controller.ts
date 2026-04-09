import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { CreateServiceDto } from "./dto/create-service.dto";
import { KnowledgeBaseService } from "./knowledge-base.service";

@ApiTags("Knowledge Base")
@ApiBearerAuth()
@Controller("businesses/:businessId/knowledge-base")
export class KnowledgeBaseController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(KnowledgeBaseService) private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  @Get("faqs")
  async listFaqs(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.knowledgeBaseService.listFaqs(businessId);
  }

  @Post("faqs")
  async addFaq(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: CreateFaqDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    const [faq] = await this.knowledgeBaseService.addFaq(businessId, dto);
    return faq;
  }

  @Get("services")
  async listServices(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.knowledgeBaseService.listServices(businessId);
  }

  @Post("services")
  async addService(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: CreateServiceDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    const [service] = await this.knowledgeBaseService.addService(businessId, dto);
    return service;
  }
}
