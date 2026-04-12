import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { MessagingModule } from "../messaging/messaging.module";
import { UpdatesController } from "./updates.controller";
import { UpdatesService } from "./updates.service";

@Module({
  imports: [BusinessesModule, MessagingModule],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
