import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { messages } from "../database/schema";
import { SendWhatsAppMessageDto } from "./dto/send-whatsapp-message.dto";
import { WhatsAppProvider } from "./providers/whatsapp.provider";

@Injectable()
export class MessagingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(WhatsAppProvider) private readonly whatsappProvider: WhatsAppProvider,
  ) {}

  async sendWhatsAppMessage(businessId: string, dto: SendWhatsAppMessageDto) {
    const delivery = await this.whatsappProvider.sendMessage(dto.recipient, dto.body);

    const [message] = await this.database.db
      .insert(messages)
      .values({
        businessId,
        leadId: dto.leadId,
        callId: dto.callId,
        recipient: dto.recipient,
        body: dto.body,
        providerMessageId: delivery.providerMessageId,
        status: delivery.status,
      })
      .returning();

    return {
      ...message,
      delivered: delivery.delivered,
    };
  }

  generateFollowUpMessage(input: { businessName: string; summary?: string; leadName?: string }) {
    const greeting = input.leadName ? `Hi ${input.leadName}` : "Hi";
    const summaryLine = input.summary
      ? ` Thanks for speaking with ${input.businessName}. Here is a quick recap: ${input.summary}.`
      : ` Thanks for speaking with ${input.businessName}.`;

    return `${greeting}.${summaryLine} Reply to this WhatsApp message if you would like us to help you further.`;
  }
}
