import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";

import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { configuration } from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { KnowledgeBaseModule } from "./knowledge-base/knowledge-base.module";
import { LeadsModule } from "./leads/leads.module";
import { MessagingModule } from "./messaging/messaging.module";
import { PlansModule } from "./plans/plans.module";
import { TelephonyModule } from "./telephony/telephony.module";
import { CallsModule } from "./calls/calls.module";
import { ProductsModule } from "./products/products.module";
import { UpdatesModule } from "./updates/updates.module";
import { UiModule } from "./ui/ui.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    BusinessesModule,
    KnowledgeBaseModule,
    TelephonyModule,
    AiModule,
    CallsModule,
    LeadsModule,
    MessagingModule,
    PlansModule,
    ProductsModule,
    UpdatesModule,
    UiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
