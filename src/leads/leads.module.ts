import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

@Module({
  imports: [BusinessesModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
