import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { CallsModule } from "../calls/calls.module";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { WhatsAppProvider } from "./providers/whatsapp.provider";
import { WhatsAppSessionStore } from "./whatsapp-session.store";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";

@Module({
  imports: [BusinessesModule, CallsModule],
  controllers: [MessagingController, WhatsAppWebhookController],
  providers: [MessagingService, WhatsAppProvider, WhatsAppSessionStore],
  exports: [MessagingService],
})
export class MessagingModule {}
