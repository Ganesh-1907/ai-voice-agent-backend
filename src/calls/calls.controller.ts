import { Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { UpdateCallTranscriptDto } from "./dto/update-call-transcript.dto";
import { CallsService } from "./calls.service";

@ApiTags("Calls")
@ApiBearerAuth()
@Controller("businesses/:businessId/calls")
export class CallsController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(CallsService) private readonly callsService: CallsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.callsService.listByBusiness(businessId);
  }

  @Get("analytics/overview")
  async analytics(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.callsService.getAnalyticsOverview(businessId);
  }

  @Get(":callId")
  async getOne(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("callId") callId: string,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.callsService.getBusinessCallOrFail(businessId, callId);
  }

  @Patch(":callId/transcript")
  async updateTranscript(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("callId") callId: string,
    @Body() dto: UpdateCallTranscriptDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.callsService.attachTranscript(callId, dto.transcript, dto.summary, dto.durationSeconds);
  }
}
