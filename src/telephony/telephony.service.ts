import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AiService } from "../ai/ai.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CallsService } from "../calls/calls.service";
import { LeadsService } from "../leads/leads.service";
import { ExotelCallWebhookDto } from "./dto/exotel-call-webhook.dto";
import { StartPublicTestCallDto } from "./dto/start-public-test-call.dto";
import { StartTestCallDto } from "./dto/start-test-call.dto";
import { TestCallCompleteDto } from "./dto/test-call-complete.dto";
import { UpdatesService } from "../updates/updates.service";
import { ExotelProvider } from "./providers/exotel.provider";

@Injectable()
export class TelephonyService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(CallsService) private readonly callsService: CallsService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(LeadsService) private readonly leadsService: LeadsService,
    @Inject(UpdatesService) private readonly updatesService: UpdatesService,
    @Inject(ExotelProvider) private readonly exotelProvider: ExotelProvider,
  ) {}

  async handleIncomingWebhook(dto: ExotelCallWebhookDto, webhookSecret?: string) {
    this.assertWebhookSecret(webhookSecret);

    const routingNumber = this.resolveRoutingNumber(dto);
    if (!routingNumber) {
      throw new NotFoundException("Could not determine business number from webhook");
    }

    const business = await this.businessesService.getByRoutingNumber(routingNumber);
    if (!business) {
      throw new NotFoundException("Business not found for incoming number");
    }

    const exotelCallSid = this.resolveCallSid(dto);
    const fromNumber = this.resolveCustomerNumber(dto) ?? "unknown";
    const toNumber = this.resolveToNumber(dto) ?? business.virtualPhoneNumber ?? business.businessPhoneNumber;

    const existingCall = exotelCallSid ? await this.callsService.getByExotelCallSid(exotelCallSid) : null;

    const call =
      existingCall ??
      (
        await this.callsService.create({
          businessId: business.id,
          exotelCallSid,
          fromNumber,
          toNumber,
          originalBusinessNumber: routingNumber,
          meta: {
            ...dto,
            webhookResolved: {
              routingNumber,
              fromNumber,
              toNumber,
              exotelCallSid,
            },
          },
        })
      )[0];

    const mappedStatus = this.mapExotelStatusToCallStatus(dto.Status ?? dto.CallStatus);
    if (existingCall && mappedStatus && existingCall.status !== mappedStatus) {
      await this.callsService.updateStatus(existingCall.id, mappedStatus);
    }

    const routing = await this.exotelProvider.connectCallToAiAgent({
      exotelCallSid,
      businessNumber: routingNumber,
      customerNumber: fromNumber,
    });

    return {
      businessId: business.id,
      callId: call.id,
      matchedBusinessNumber: business.businessPhoneNumber,
      agentGreeting: this.businessesService.getAgentGreeting(business),
      routing,
      nextStep: "Forward call to central AI agent number and use the matched business context for the conversation.",
    };
  }

  async processAgentTurn(callId: string, customerText: string) {
    const call = await this.callsService.getByIdOrFail(callId);
    const business = await this.businessesService.findByIdOrFail(call.businessId);
    await this.callsService.updateStatus(callId, "in_progress");
    const callWithCustomerTurn = await this.callsService.appendConversationTurn(callId, {
      speaker: "customer",
      text: customerText,
      createdAt: new Date().toISOString(),
    });
    const conversationContext = await this.callsService.buildTranscriptFromMeta(callWithCustomerTurn);

    const aiReply = await this.aiService.processCallTurn(business, customerText, conversationContext);
    await this.callsService.appendConversationTurn(callId, {
      speaker: "agent",
      text: aiReply.replyText,
      createdAt: new Date().toISOString(),
    });

    return {
      callId,
      businessId: business.id,
      businessName: business.name,
      greeting: this.businessesService.getAgentGreeting(business),
      customerText,
      aiReply,
    };
  }

  async startTestCall(dto: StartTestCallDto) {
    const business = await this.businessesService.findByIdOrFail(dto.businessId);
    const [call] = await this.callsService.create({
      businessId: business.id,
      fromNumber: "test-console",
      toNumber: business.businessPhoneNumber,
      originalBusinessNumber: business.businessPhoneNumber,
      meta: {
        mode: "test-call",
        turns: [],
      },
    });

    return {
      callId: call.id,
      businessId: business.id,
      businessName: business.name,
      greeting: this.businessesService.getAgentGreeting(business),
      note: "This is a browser-based test call session. WhatsApp follow-up is disabled.",
    };
  }

  async startPublicTestCall(dto: StartPublicTestCallDto) {
    const business = await this.businessesService.getByRoutingNumber(dto.toNumber);
    if (!business) {
      throw new NotFoundException("No business matched this dialed number");
    }

    const [call] = await this.callsService.create({
      businessId: business.id,
      fromNumber: dto.fromNumber,
      toNumber: dto.toNumber,
      originalBusinessNumber: dto.toNumber,
      meta: {
        mode: "public-test-call",
        turns: [],
      },
    });

    return {
      callId: call.id,
      businessId: business.id,
      businessName: business.name,
      greeting: this.businessesService.getAgentGreeting(business),
    };
  }

  transcribeAudio(input: { buffer: Buffer; filename: string; mimeType: string }) {
    return this.aiService.transcribeAudio(input);
  }

  async simulateAgentTurn(businessId: string, customerText: string) {
    this.assertDevelopmentMode();

    const business = await this.businessesService.findByIdOrFail(businessId);
    const aiReply = await this.aiService.processCallTurn(business, customerText);

    return {
      mode: "dev-simulation",
      businessId: business.id,
      businessName: business.name,
      customerText,
      aiReply,
    };
  }

  connectExotelCall(input: {
    fromNumber: string;
    toNumber: string;
    callerId?: string;
    statusCallbackUrl?: string;
    record?: boolean;
  }) {
    return this.exotelProvider.connectTwoNumbers(input);
  }

  connectExotelCallToApp(input: {
    customerNumber: string;
    appUrl?: string;
    callerId?: string;
    statusCallbackUrl?: string;
    customField?: string;
  }) {
    return this.exotelProvider.connectCustomerToApp(input);
  }

  async completeTestCall(callId: string, body: TestCallCompleteDto) {
    const call = await this.callsService.getByIdOrFail(callId);
    const transcript = await this.callsService.buildTranscriptFromMeta(call);
    const summary = await this.aiService.generateSummary(transcript || body.notes || "Test call completed.");
    const updatedCall = await this.callsService.attachTranscript(callId, transcript, summary);
    await this.callsService.updateStatus(callId, "completed");
    const update = await this.updatesService.createFromCall({
      businessId: call.businessId,
      callId,
      fromNumber: call.fromNumber,
      summary,
      transcript,
    });

    let lead = null;
    if (body.customerPhone) {
      const extractedLead = await this.aiService.extractLeadData(transcript);
      const [createdLead] = await this.leadsService.create(
        call.businessId,
        {
          name: extractedLead.name,
          phone: body.customerPhone,
          intent: extractedLead.intent,
          notes: body.notes ?? extractedLead.notes,
        },
        callId,
      );
      lead = createdLead;
    }

    return {
      call: updatedCall,
      lead,
      update,
      whatsappDisabled: true,
    };
  }

  async handleCallCompletion(input: {
    businessId: string;
    callId: string;
    transcript: string;
    customerPhone: string;
  }) {
    const business = await this.businessesService.findByIdOrFail(input.businessId);
    const summary = await this.aiService.generateSummary(input.transcript);
    const call = await this.callsService.attachTranscript(input.callId, input.transcript, summary);
    await this.callsService.updateStatus(input.callId, "completed");
    const update = await this.updatesService.createFromCall({
      businessId: input.businessId,
      callId: input.callId,
      fromNumber: input.customerPhone,
      summary,
      transcript: input.transcript,
    });

    const extractedLead = await this.aiService.extractLeadData(input.transcript);
    const [lead] = await this.leadsService.create(
      input.businessId,
      {
        name: extractedLead.name,
        phone: input.customerPhone,
        intent: extractedLead.intent,
        notes: extractedLead.notes,
      },
      input.callId,
    );

    return {
      call,
      lead,
      update,
      message: null,
      whatsappDisabled: true,
      nextStep: `Call stored for ${business.name}. WhatsApp follow-up is disabled for now.`,
    };
  }

  async handleCallStatusWebhook(dto: ExotelCallWebhookDto) {
    const exotelCallSid = this.resolveCallSid(dto);
    if (!exotelCallSid) {
      return { ignored: true, reason: "no call SID" };
    }

    const call = await this.callsService.getByExotelCallSid(exotelCallSid);
    if (!call) {
      return { ignored: true, reason: "call not found" };
    }

    const rawStatus = this.readField(dto, ["CallStatus", "Status", "call_status", "status"]);
    const mappedStatus = this.mapExotelStatusToCallStatus(rawStatus);
    const rawDuration = this.readField(dto, ["Duration", "RecordingDuration", "duration"]);
    const durationSeconds = rawDuration ? Math.round(Number(rawDuration)) : undefined;

    if (mappedStatus && call.status !== mappedStatus) {
      await this.callsService.updateStatus(call.id, mappedStatus);
    }

    if (durationSeconds !== undefined && durationSeconds > 0 && !call.durationSeconds) {
      await this.callsService.attachTranscript(
        call.id,
        call.transcript ?? "",
        call.summary ?? undefined,
        durationSeconds,
      );
    }

    return { callId: call.id, status: mappedStatus, durationSeconds };
  }

  private assertDevelopmentMode() {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";
    if (nodeEnv === "production") {
      throw new NotFoundException("Test call simulation is not available in production");
    }
  }

  private assertWebhookSecret(webhookSecret?: string) {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";
    if (nodeEnv !== "production") {
      return;
    }

    const configuredSecret = this.configService.get<string>("WEBHOOK_SECRET");
    if (!configuredSecret) {
      throw new ForbiddenException("Webhook secret is not configured");
    }

    if (!webhookSecret || webhookSecret !== configuredSecret) {
      throw new ForbiddenException("Invalid webhook secret");
    }
  }

  private resolveRoutingNumber(dto: ExotelCallWebhookDto) {
    const explicitBusinessNumber = this.firstString([
      dto.OriginalBusinessNumber,
      dto.OriginalCalledNumber,
      dto.CalledNumber,
      dto.DialWhomNumber,
      this.readField(dto, [
        "OriginalBusinessNumber",
        "OriginalCalledNumber",
        "CalledNumber",
        "DialWhomNumber",
        "original_business_number",
        "original_called_number",
        "called_number",
        "dial_whom_number",
        "destination",
        "Destination",
      ]),
    ]);

    if (explicitBusinessNumber) {
      return explicitBusinessNumber;
    }

    const toNumber = this.resolveToNumber(dto);
    if (toNumber && this.isCentralAgentNumber(toNumber)) {
      return toNumber;
    }

    return toNumber ?? this.resolveCustomerNumber(dto) ?? null;
  }

  private resolveCallSid(dto: ExotelCallWebhookDto) {
    return this.firstString([
      dto.CallSid,
      this.readField(dto, ["CallSid", "call_sid", "Sid", "sid", "CallUUID", "call_uuid"]),
    ]);
  }

  private resolveCustomerNumber(dto: ExotelCallWebhookDto) {
    return this.firstString([
      this.readField(dto, ["CallFrom", "call_from"]),
      dto.From,
      this.readField(dto, ["From", "from", "Caller", "caller", "CallerNumber", "caller_number"]),
    ]);
  }

  private resolveToNumber(dto: ExotelCallWebhookDto) {
    return this.firstString([
      this.readField(dto, ["CallTo", "call_to"]),
      dto.To,
      this.readField(dto, ["To", "to", "Called", "called", "ToNumber", "to_number"]),
    ]);
  }

  private mapExotelStatusToCallStatus(status: string | undefined): "initiated" | "in_progress" | "completed" | "failed" | null {
    if (!status) {
      return null;
    }

    const normalized = status.toLowerCase().trim();
    if (["queued", "initiated", "ringing"].includes(normalized)) {
      return "initiated";
    }
    if (["in-progress", "in progress", "ongoing", "active", "answered"].includes(normalized)) {
      return "in_progress";
    }
    if (["completed", "ended", "hangup", "hanguped", "finished"].includes(normalized)) {
      return "completed";
    }
    if (["failed", "busy", "no-answer", "no answer", "canceled", "cancelled"].includes(normalized)) {
      return "failed";
    }

    return null;
  }

  private readField(payload: Record<string, unknown>, keys: string[]) {
    const normalizedLookup = new Map<string, unknown>();
    for (const [key, value] of Object.entries(payload)) {
      normalizedLookup.set(this.normalizeFieldKey(key), value);
    }

    for (const key of keys) {
      const value = normalizedLookup.get(this.normalizeFieldKey(key));
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private normalizeFieldKey(value: string) {
    return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  }

  private firstString(values: Array<string | undefined>) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private isCentralAgentNumber(phoneNumber: string) {
    const configuredNumbers = [
      this.configService.get<string>("CENTRAL_AGENT_NUMBER"),
      this.configService.get<string>("EXOTEL_VIRTUAL_NUMBER"),
      this.configService.get<string>("EXOTEL_CALLER_ID"),
    ];

    const incomingDigits = phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
    return configuredNumbers.some((configured) => {
      if (!configured) {
        return false;
      }

      const configuredDigits = configured.replace(/\D/g, "").replace(/^0+/, "");
      return incomingDigits === configuredDigits || incomingDigits.endsWith(configuredDigits) || configuredDigits.endsWith(incomingDigits);
    });
  }
}
