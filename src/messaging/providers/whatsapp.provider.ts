import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type SendResult = {
  delivered: boolean;
  providerMessageId: string | null;
  status: "sent" | "failed" | "not_configured";
};

type InteractiveButton = {
  id: string;
  title: string;
};

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const token = this.configService.get<string>("WHATSAPP_ACCESS_TOKEN");
    const phoneId = this.configService.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    return Boolean(token && phoneId);
  }

  private getApiUrl(): string | null {
    const phoneId = this.configService.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    if (!phoneId) return null;
    return `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  }

  async sendTextMessage(recipient: string, body: string): Promise<SendResult> {
    return this.send(recipient, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.normalizePhone(recipient),
      type: "text",
      text: { preview_url: false, body },
    });
  }

  async sendInteractiveButtons(
    recipient: string,
    bodyText: string,
    buttons: InteractiveButton[],
    headerText?: string,
    footerText?: string,
  ): Promise<SendResult> {
    const interactive: Record<string, unknown> = {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: btn.title.slice(0, 20) },
        })),
      },
    };

    if (headerText) {
      interactive.header = { type: "text", text: headerText };
    }

    if (footerText) {
      interactive.footer = { text: footerText };
    }

    return this.send(recipient, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.normalizePhone(recipient),
      type: "interactive",
      interactive,
    });
  }

  async sendImageMessage(recipient: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.send(recipient, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.normalizePhone(recipient),
      type: "image",
      image: {
        link: imageUrl,
        ...(caption ? { caption } : {}),
      },
    });
  }

  private async send(recipient: string, payload: Record<string, unknown>): Promise<SendResult> {
    const apiUrl = this.getApiUrl();
    const token = this.configService.get<string>("WHATSAPP_ACCESS_TOKEN");

    if (!apiUrl || !token) {
      this.logger.warn("WhatsApp provider is not configured; message stored but not delivered");
      return { delivered: false, providerMessageId: null, status: "not_configured" };
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const payloadText = await response.text();
      let parsed: Record<string, unknown> = {};
      if (payloadText.trim()) {
        try {
          parsed = JSON.parse(payloadText) as Record<string, unknown>;
        } catch {
          this.logger.warn("WhatsApp provider returned non-JSON response payload");
        }
      }

      if (!response.ok) {
        this.logger.error(
          `WhatsApp sendMessage failed status=${response.status} body=${payloadText.slice(0, 500)}`,
        );
        return { delivered: false, providerMessageId: null, status: "failed" };
      }

      const messages = parsed.messages as Array<{ id?: string }> | undefined;
      const providerMessageId = messages?.[0]?.id ?? null;

      return { delivered: true, providerMessageId, status: "sent" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown WhatsApp error";
      this.logger.error(`WhatsApp sendMessage error: ${message}`);
      return { delivered: false, providerMessageId: null, status: "failed" };
    }
  }

  private normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      const countryCode = this.configService.get<string>("DEFAULT_COUNTRY_CODE") ?? "+91";
      digits = countryCode.replace("+", "") + digits;
    }
    return digits;
  }
}
