import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { CallsModule } from "../calls/calls.module";
import { LeadsModule } from "../leads/leads.module";
import { TelephonyController } from "./telephony.controller";
import { TelephonyService } from "./telephony.service";
import { ExotelProvider } from "./providers/exotel.provider";

@Module({
  imports: [BusinessesModule, CallsModule, AiModule, LeadsModule],
  controllers: [TelephonyController],
  providers: [TelephonyService, ExotelProvider],
})
export class TelephonyModule {}
