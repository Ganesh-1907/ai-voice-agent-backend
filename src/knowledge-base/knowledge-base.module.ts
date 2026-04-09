import { Module } from "@nestjs/common";

import { BusinessesModule } from "../businesses/businesses.module";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";

@Module({
  imports: [BusinessesModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
