import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { JwtUser } from "../auth/types/jwt-user.type";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UpdateCallbackStatusDto } from "./dto/update-callback-status.dto";
import { UpdateCallLeadStatusDto } from "./dto/update-call-lead-status.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { UiService } from "./ui.service";

@ApiTags("UI")
@ApiBearerAuth()
@Controller()
export class UiController {
  constructor(@Inject(UiService) private readonly uiService: UiService) {}

  @Get("dashboard/stats")
  getDashboardStats(@CurrentUser() user: JwtUser, @Query("businessId") businessId?: string) {
    return this.uiService.getDashboardStats(user.sub, businessId);
  }

  @Get("call-leads")
  listCallLeads(@CurrentUser() user: JwtUser, @Query("businessId") businessId?: string) {
    return this.uiService.listCallLeads(user.sub, businessId);
  }

  @Patch("call-leads/:callId/status")
  updateCallLeadStatus(
    @CurrentUser() user: JwtUser,
    @Param("callId") callId: string,
    @Body() dto: UpdateCallLeadStatusDto,
  ) {
    return this.uiService.updateCallLeadStatus(user.sub, callId, dto.status);
  }

  @Get("orders")
  listOrders(@CurrentUser() user: JwtUser, @Query("businessId") businessId?: string) {
    return this.uiService.listOrders(user.sub, businessId);
  }

  @Patch("orders/:orderId/status")
  updateOrderStatus(
    @CurrentUser() user: JwtUser,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.uiService.updateOrderStatus(user.sub, orderId, dto.status);
  }

  @Get("callbacks")
  listCallbacks(@CurrentUser() user: JwtUser, @Query("businessId") businessId?: string) {
    return this.uiService.listCallbacks(user.sub, businessId);
  }

  @Patch("callbacks/:callbackId/status")
  updateCallbackStatus(
    @CurrentUser() user: JwtUser,
    @Param("callbackId") callbackId: string,
    @Body() dto: UpdateCallbackStatusDto,
  ) {
    return this.uiService.updateCallbackStatus(user.sub, callbackId, dto.status);
  }
}
