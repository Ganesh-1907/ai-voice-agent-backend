import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { CallsModule } from "../calls/calls.module";
import { LeadsModule } from "../leads/leads.module";
import { UpdatesModule } from "../updates/updates.module";
import { TelephonyController } from "./telephony.controller";
import { TelephonyService } from "./telephony.service";
import { ExotelProvider } from "./providers/exotel.provider";
import { VoicebotWebSocketService } from "./voicebot-websocket.service";

@Module({
  imports: [BusinessesModule, CallsModule, AiModule, LeadsModule, UpdatesModule],
  controllers: [TelephonyController],
  providers: [TelephonyService, ExotelProvider, VoicebotWebSocketService],
  exports: [VoicebotWebSocketService],
})
export class TelephonyModule {}
