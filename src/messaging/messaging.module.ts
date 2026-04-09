import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { WhatsAppProvider } from "./providers/whatsapp.provider";

@Module({
  imports: [BusinessesModule],
  controllers: [MessagingController],
  providers: [MessagingService, WhatsAppProvider],
  exports: [MessagingService],
})
export class MessagingModule {}
