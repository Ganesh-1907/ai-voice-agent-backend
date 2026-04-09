import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { KnowledgeBaseModule } from "../knowledge-base/knowledge-base.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ElevenLabsProvider } from "./providers/elevenlabs.provider";
import { OpenAiProvider } from "./providers/openai.provider";

@Module({
  imports: [BusinessesModule, KnowledgeBaseModule],
  controllers: [AiController],
  providers: [AiService, OpenAiProvider, ElevenLabsProvider],
  exports: [AiService],
})
export class AiModule {}
