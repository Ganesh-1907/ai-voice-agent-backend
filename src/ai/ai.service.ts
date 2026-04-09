import { Inject, Injectable } from "@nestjs/common";

import { businesses } from "../database/schema";
import { KnowledgeBaseService } from "../knowledge-base/knowledge-base.service";
import { ElevenLabsProvider } from "./providers/elevenlabs.provider";
import { OpenAiProvider } from "./providers/openai.provider";

@Injectable()
export class AiService {
  constructor(
    @Inject(KnowledgeBaseService) private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(OpenAiProvider) private readonly openAiProvider: OpenAiProvider,
    @Inject(ElevenLabsProvider) private readonly elevenLabsProvider: ElevenLabsProvider,
  ) {}

  async processCallTurn(business: typeof businesses.$inferSelect, customerText: string) {
    const context = await this.knowledgeBaseService.buildBusinessContext(business.id);
    const systemPrompt = [
      `You are an AI voice agent for ${business.name}.`,
      "Answer using only the provided business context when possible.",
      "If you do not know the answer, politely collect the user's details and say a human will follow up.",
      "Keep responses concise because they will be spoken aloud on a phone call.",
      context.promptContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const reply = await this.openAiProvider.generateReply(systemPrompt, customerText);
    const speech = await this.elevenLabsProvider.textToSpeech(reply.text);

    return {
      inputText: customerText,
      replyText: reply.text,
      audioBase64: speech.audioBase64,
    };
  }

  extractLeadData(transcript: string) {
    return this.openAiProvider.extractLeadData(transcript);
  }

  generateSummary(transcript: string) {
    return this.openAiProvider.generateSummary(transcript);
  }

  transcribeAudio(input: { buffer: Buffer; filename: string; mimeType: string }) {
    return this.openAiProvider.transcribeAudio(input);
  }
}
