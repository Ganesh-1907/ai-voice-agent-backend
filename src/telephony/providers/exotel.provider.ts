import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ExotelProvider {
  private readonly logger = new Logger(ExotelProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async connectTwoNumbers(input: {
    fromNumber: string;
    toNumber: string;
    callerId?: string;
    statusCallbackUrl?: string;
    record?: boolean;
  }) {
    const apiKey = this.configService.get<string>("EXOTEL_API_KEY");
    const apiToken = this.configService.get<string>("EXOTEL_API_TOKEN");
    const sid = this.configService.get<string>("EXOTEL_SID");
    const subdomain = this.configService.get<string>("EXOTEL_SUBDOMAIN") ?? "api.in.exotel.com";
    const callerId =
      input.callerId ??
      this.configService.get<string>("EXOTEL_CALLER_ID") ??
      this.configService.get<string>("EXOTEL_VIRTUAL_NUMBER");

    if (!apiKey || !apiToken || !sid || !callerId) {
      throw new ServiceUnavailableException(
        "Exotel is not configured. Set EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, and EXOTEL_CALLER_ID or EXOTEL_VIRTUAL_NUMBER.",
      );
    }

    const url = `https://${subdomain}/v1/Accounts/${encodeURIComponent(sid)}/Calls/connect.json`;
    const form = new URLSearchParams({
      From: this.formatPhoneNumberForExotel(input.fromNumber),
      To: this.formatPhoneNumberForExotel(input.toNumber),
      CallerId: callerId,
    });

    if (input.statusCallbackUrl) {
      form.set("StatusCallback", input.statusCallbackUrl);
      form.set("StatusCallbackContentType", "application/json");
      form.set("StatusCallbackEvents[0]", "terminal");
      form.set("StatusCallbackEvents[1]", "answered");
    }

    if (input.record !== undefined) {
      form.set("Record", input.record ? "true" : "false");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const rawBody = await response.text();
    const data = this.parseResponse(rawBody);

    if (!response.ok) {
      this.logger.error(`Exotel connect call failed with HTTP ${response.status}: ${rawBody}`);
      throw new BadGatewayException({
        message: "Exotel connect call failed",
        statusCode: response.status,
        response: data,
      });
    }

    return {
      provider: "exotel",
      mode: "connect-two-numbers",
      statusCode: response.status,
      request: {
        fromNumber: this.formatPhoneNumberForExotel(input.fromNumber),
        toNumber: this.formatPhoneNumberForExotel(input.toNumber),
        callerId,
      },
      response: data,
    };
  }

  async connectCustomerToApp(input: {
    customerNumber: string;
    appUrl?: string;
    callerId?: string;
    statusCallbackUrl?: string;
    customField?: string;
  }) {
    const apiKey = this.configService.get<string>("EXOTEL_API_KEY");
    const apiToken = this.configService.get<string>("EXOTEL_API_TOKEN");
    const sid = this.configService.get<string>("EXOTEL_SID");
    const subdomain = this.configService.get<string>("EXOTEL_SUBDOMAIN") ?? "api.in.exotel.com";
    const callerId =
      input.callerId ??
      this.configService.get<string>("EXOTEL_CALLER_ID") ??
      this.configService.get<string>("EXOTEL_VIRTUAL_NUMBER");
    const appUrl = input.appUrl ?? this.configService.get<string>("EXOTEL_APP_URL");

    if (!apiKey || !apiToken || !sid || !callerId) {
      throw new ServiceUnavailableException(
        "Exotel is not configured. Set EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, and EXOTEL_CALLER_ID or EXOTEL_VIRTUAL_NUMBER.",
      );
    }

    if (!appUrl) {
      throw new BadRequestException("Missing Exotel app URL. Pass appUrl or configure EXOTEL_APP_URL.");
    }

    const url = `https://${subdomain}/v1/Accounts/${encodeURIComponent(sid)}/Calls/connect.json`;
    const form = new URLSearchParams({
      From: this.formatPhoneNumberForExotel(input.customerNumber),
      CallerId: callerId,
      CallType: "trans",
      Url: appUrl,
    });

    if (input.statusCallbackUrl) {
      form.set("StatusCallback", input.statusCallbackUrl);
    }

    if (input.customField) {
      form.set("CustomField", input.customField);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const rawBody = await response.text();
    const data = this.parseResponse(rawBody);

    if (!response.ok) {
      this.logger.error(`Exotel connect-to-app call failed with HTTP ${response.status}: ${rawBody}`);
      throw new BadGatewayException({
        message: "Exotel connect-to-app call failed",
        statusCode: response.status,
        response: data,
      });
    }

    return {
      provider: "exotel",
      mode: "connect-customer-to-app",
      statusCode: response.status,
      request: {
        customerNumber: this.formatPhoneNumberForExotel(input.customerNumber),
        callerId,
        appUrl,
        customField: input.customField,
      },
      response: data,
    };
  }

  async connectCallToAiAgent(input: {
    exotelCallSid?: string;
    businessNumber?: string;
    customerNumber?: string;
  }) {
    const sid = this.configService.get<string>("EXOTEL_SID");
    const virtualNumber =
      this.configService.get<string>("CENTRAL_AGENT_NUMBER") ??
      this.configService.get<string>("EXOTEL_VIRTUAL_NUMBER");

    if (!sid || !virtualNumber) {
      this.logger.warn("Exotel is not fully configured; returning simulated routing");
      return {
        routed: false,
        routeTarget: "simulated-ai-agent",
        input,
      };
    }

    return {
      routed: true,
      routeTarget: virtualNumber,
      mode: "central-agent-number",
      input,
    };
  }

  private parseResponse(rawBody: string) {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return rawBody;
    }
  }

  private formatPhoneNumberForExotel(phoneNumber: string) {
    const normalized = phoneNumber.trim().replace(/[^\d+]/g, "");
    const digits = normalized.replace(/\D/g, "");

    if (/^0\d{10,}$/.test(digits)) {
      return digits;
    }

    if ((normalized.startsWith("+91") || digits.startsWith("91")) && digits.length >= 12) {
      return `0${digits.slice(-10)}`;
    }

    if (digits.length === 10) {
      return `0${digits}`;
    }

    return normalized;
  }
}
