import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Public } from "../common/decorators/public.decorator";
import { MessagingService } from "./messaging.service";

/**
 * Public webhook controller for Meta WhatsApp Cloud API.
 *
 * Configure this URL in Meta WhatsApp Business Platform:
 *   Webhook URL: https://<your-domain>/api/webhooks/whatsapp
 *   Verify Token: value of WHATSAPP_WEBHOOK_VERIFY_TOKEN from .env
 *   Subscribed fields: messages
 */
@ApiTags("WhatsApp Webhook")
@Controller("webhooks/whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(MessagingService) private readonly messagingService: MessagingService,
  ) {}

  /**
   * GET /api/webhooks/whatsapp
   * Meta webhook verification endpoint.
   * Meta sends hub.mode, hub.verify_token, and hub.challenge.
   * We must return hub.challenge if the token matches.
   */
  @Public()
  @Get()
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") verifyToken: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response,
  ) {
    const configuredToken = this.configService.get<string>("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && verifyToken === configuredToken) {
      this.logger.log("WhatsApp webhook verified successfully");
      return res.status(200).send(challenge);
    }

    this.logger.warn(`WhatsApp webhook verification failed: mode=${mode}`);
    return res.status(403).send("Verification failed");
  }

  /**
   * POST /api/webhooks/whatsapp
   * Receives incoming messages, button replies, and delivery status updates from Meta.
   */
  @Public()
  @Post()
  async incoming(@Body() body: Record<string, unknown>, @Res() res: Response) {
    // Always respond 200 quickly to Meta (they retry on non-2xx)
    res.status(200).send("EVENT_RECEIVED");

    try {
      await this.processWebhookPayload(body);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown webhook error";
      this.logger.error(`Webhook processing error: ${msg}`);
    }
  }

  private async processWebhookPayload(body: Record<string, unknown>) {
    const entry = body.entry as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(entry)) {
      return;
    }

    for (const entryItem of entry) {
      const changes = entryItem.changes as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(changes)) {
        continue;
      }

      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) {
          continue;
        }

        // Process delivery status updates
        const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(statuses)) {
          for (const statusUpdate of statuses) {
            await this.handleStatusUpdate(statusUpdate);
          }
        }

        // Process incoming messages
        const messages = value.messages as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(messages)) {
          for (const message of messages) {
            await this.handleIncomingMessage(message);
          }
        }
      }
    }
  }

  private async handleStatusUpdate(statusUpdate: Record<string, unknown>) {
    const providerMessageId = statusUpdate.id as string | undefined;
    const rawStatus = statusUpdate.status as string | undefined;

    if (!providerMessageId || !rawStatus) {
      return;
    }

    const statusMap: Record<string, "sent" | "delivered" | "read" | "failed"> = {
      sent: "sent",
      delivered: "delivered",
      read: "read",
      failed: "failed",
    };

    const mapped = statusMap[rawStatus];
    if (!mapped) {
      return;
    }

    const errors = statusUpdate.errors as Array<{ title?: string; message?: string }> | undefined;
    const errorMessage = errors?.[0]?.message ?? errors?.[0]?.title;

    this.logger.log(`Status update: msgId=${providerMessageId} status=${mapped}`);
    await this.messagingService.updateMessageStatus(providerMessageId, mapped, errorMessage);
  }

  private async handleIncomingMessage(message: Record<string, unknown>) {
    const from = message.from as string | undefined;
    const type = message.type as string | undefined;

    if (!from) {
      return;
    }

    // Interactive button reply
    if (type === "interactive") {
      const interactive = message.interactive as Record<string, unknown> | undefined;
      const interactiveType = interactive?.type as string | undefined;

      if (interactiveType === "button_reply") {
        const buttonReply = interactive?.button_reply as { id?: string; title?: string } | undefined;
        const buttonId = buttonReply?.id;

        if (buttonId) {
          this.logger.log(`Button reply: from=${from} buttonId=${buttonId}`);
          await this.messagingService.handleUserButtonReply(from, buttonId);
          return;
        }
      }
    }

    // Any text message or other type → remind them to use buttons
    if (type === "text" || type === "audio" || type === "document" || type === "video" || type === "sticker") {
      this.logger.log(`Free text message from=${from} type=${type} — sending button reminder`);
      await this.messagingService.handleFreeTextMessage(from);
      return;
    }

    this.logger.log(`Unhandled message type=${type} from=${from}`);
  }
}
