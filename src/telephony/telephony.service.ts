import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AiService } from "../ai/ai.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CallsService } from "../calls/calls.service";
import { LeadsService } from "../leads/leads.service";
import { ExotelCallWebhookDto } from "./dto/exotel-call-webhook.dto";
import { StartTestCallDto } from "./dto/start-test-call.dto";
import { TestCallCompleteDto } from "./dto/test-call-complete.dto";
import { ExotelProvider } from "./providers/exotel.provider";

@Injectable()
export class TelephonyService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(CallsService) private readonly callsService: CallsService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(LeadsService) private readonly leadsService: LeadsService,
    @Inject(ExotelProvider) private readonly exotelProvider: ExotelProvider,
  ) {}

  async handleIncomingWebhook(dto: ExotelCallWebhookDto) {
    const routingNumber = dto.OriginalBusinessNumber ?? dto.To;
    if (!routingNumber) {
      throw new NotFoundException("Could not determine business number from webhook");
    }

    const business = await this.businessesService.getByRoutingNumber(routingNumber);
    if (!business) {
      throw new NotFoundException("Business not found for incoming number");
    }

    const [call] = await this.callsService.create({
      businessId: business.id,
      exotelCallSid: dto.CallSid,
      fromNumber: dto.From ?? "unknown",
      toNumber: dto.To ?? business.virtualPhoneNumber ?? business.businessPhoneNumber,
      originalBusinessNumber: routingNumber,
      meta: dto,
    });

    const routing = await this.exotelProvider.connectCallToAiAgent({
      exotelCallSid: dto.CallSid,
      businessNumber: routingNumber,
      customerNumber: dto.From,
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
    await this.callsService.appendConversationTurn(callId, {
      speaker: "customer",
      text: customerText,
      createdAt: new Date().toISOString(),
    });

    const aiReply = await this.aiService.processCallTurn(business, customerText);
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

  async completeTestCall(callId: string, body: TestCallCompleteDto) {
    const call = await this.callsService.getByIdOrFail(callId);
    const transcript = this.callsService.buildTranscriptFromMeta(call);
    const summary = await this.aiService.generateSummary(transcript || body.notes || "Test call completed.");
    const updatedCall = await this.callsService.attachTranscript(callId, transcript, summary);
    await this.callsService.updateStatus(callId, "completed");

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
      message: null,
      whatsappDisabled: true,
      nextStep: `Call stored for ${business.name}. WhatsApp follow-up is disabled for now.`,
    };
  }

  private assertDevelopmentMode() {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";
    if (nodeEnv === "production") {
      throw new NotFoundException("Test call simulation is not available in production");
    }
  }
}
