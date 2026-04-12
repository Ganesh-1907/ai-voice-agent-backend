import { Inject, Injectable } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses } from "../database/schema";
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

    const [row] = await this.database.db
      .select({ id: businesses.id, metadata: businesses.metadata })
      .from(businesses)
      .where(eq(businesses.id, Number(businessId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Business not found");
    }

    const metadata = { ...((row.metadata ?? {}) as Record<string, unknown>) };
    const existingMessages = Array.isArray(metadata.messages) ? metadata.messages : [];
    const message = {
      id: crypto.randomUUID(),
      businessId,
      leadId: dto.leadId,
      callId: dto.callId,
      channel: "whatsapp",
      recipient: dto.recipient,
      body: dto.body,
      providerMessageId: delivery.providerMessageId,
      status: delivery.status,
      createdAt: new Date().toISOString(),
    };

    metadata.messages = [message, ...existingMessages].slice(0, 500);

    await this.database.db
      .update(businesses)
      .set({
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, Number(businessId)));

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
