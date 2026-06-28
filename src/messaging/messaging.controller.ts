import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { CallsService } from "../calls/calls.service";
import { SendWhatsAppMessageDto } from "./dto/send-whatsapp-message.dto";
import { SendFollowUpDto } from "./dto/whatsapp-webhook.dto";
import { MessagingService } from "./messaging.service";

@ApiTags("Messaging")
@ApiBearerAuth()
@Controller("businesses/:businessId/messaging")
export class MessagingController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(MessagingService) private readonly messagingService: MessagingService,
    @Inject(CallsService) private readonly callsService: CallsService,
  ) {}

  @Get("whatsapp/config")
  async getConfig(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return { configured: this.messagingService.isWhatsAppConfigured() };
  }

  @Post("whatsapp")
  async sendWhatsApp(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    // Use the legacy generateFollowUpMessage for direct sends
    const message = this.messagingService.generateFollowUpMessage({
      businessName: "Business",
      summary: dto.body,
    });
    return { message, note: "Use the post-call follow-up endpoint for full workflow." };
  }

  @Get("whatsapp/history")
  async getHistory(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.messagingService.getMessageHistory(
      businessId,
      Number(limit) || 50,
      Number(offset) || 0,
    );
  }

  @Post("whatsapp/:messageId/resend")
  async resendMessage(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("messageId") messageId: string,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.messagingService.resendMessage(businessId, messageId);
  }

  @Post("whatsapp/send-followup")
  async sendFollowUp(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: SendFollowUpDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);

    if (!dto.callId) {
      return { error: "callId is required" };
    }

    const business = await this.businessesService.findByIdOrFail(businessId);
    const call = await this.callsService.getBusinessCallOrFail(businessId, dto.callId);
    const customerPhone = dto.customerPhone ?? call.fromNumber;

    return this.messagingService.sendPostCallFollowUp({
      businessId,
      businessName: business.name,
      callId: dto.callId,
      customerPhone,
      callSummary: call.summary ?? "Thank you for your call.",
      productsAsked: [],
      hasOrder: false,
    });
  }
}
