import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async sendMessage(recipient: string, body: string) {
    const apiUrl = this.configService.get<string>("WHATSAPP_API_URL");
    const token = this.configService.get<string>("WHATSAPP_API_TOKEN");
    const senderId = this.configService.get<string>("WHATSAPP_SENDER_ID");

    if (!apiUrl || !token || !senderId) {
      this.logger.warn("WhatsApp provider is not configured; message stored but not delivered");
      return {
        delivered: false,
        providerMessageId: null,
        status: "not_configured",
      };
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from: senderId,
          to: recipient,
          type: "text",
          text: {
            body,
          },
        }),
      });

      const payloadText = await response.text();
      let payload: Record<string, unknown> = {};
      if (payloadText.trim()) {
        try {
          payload = JSON.parse(payloadText) as Record<string, unknown>;
        } catch {
          this.logger.warn("WhatsApp provider returned non-JSON response payload");
        }
      }

      if (!response.ok) {
        this.logger.error(`WhatsApp sendMessage failed with status ${response.status}`);
      }

      return {
        delivered: response.ok,
        providerMessageId:
          typeof payload.messageId === "string"
            ? payload.messageId
            : typeof payload.messages === "object"
              ? JSON.stringify(payload.messages)
              : null,
        status: response.ok ? "sent" : "failed",
        payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown WhatsApp error";
      this.logger.error(`WhatsApp sendMessage error: ${message}`);
      return {
        delivered: false,
        providerMessageId: null,
        status: "failed",
        payload: {},
      };
    }
  }
}
