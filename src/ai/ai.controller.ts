import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { ProcessCallTurnDto } from "./dto/process-call-turn.dto";
import { AiService } from "./ai.service";

@ApiTags("AI")
@ApiBearerAuth()
@Controller("businesses/:businessId/ai")
export class AiController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(AiService) private readonly aiService: AiService,
  ) {}

  @Post("reply")
  async reply(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: ProcessCallTurnDto,
  ) {
    const business = await this.businessesService.assertAccess(user.sub, businessId);
    return this.aiService.processCallTurn(business, dto.customerText);
  }
}
