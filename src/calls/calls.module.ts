import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";

@Module({
  imports: [BusinessesModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
