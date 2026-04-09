import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { SendWhatsAppMessageDto } from "./dto/send-whatsapp-message.dto";
import { MessagingService } from "./messaging.service";

@ApiTags("Messaging")
@ApiBearerAuth()
@Controller("businesses/:businessId/messaging")
export class MessagingController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(MessagingService) private readonly messagingService: MessagingService,
  ) {}

  @Post("whatsapp")
  async sendWhatsApp(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.messagingService.sendWhatsAppMessage(businessId, dto);
  }
}
