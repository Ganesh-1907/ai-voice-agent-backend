import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { ApproveUpdateDto } from "./dto/approve-update.dto";
import { MarkCallbackCompletedDto } from "./dto/mark-callback-completed.dto";
import { UpdatesService } from "./updates.service";

@ApiTags("Updates")
@ApiBearerAuth()
@Controller("businesses/:businessId/updates")
export class UpdatesController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(UpdatesService) private readonly updatesService: UpdatesService,
  ) {}

  @Get()
  async listBusinessUpdates(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.updatesService.listByBusiness(businessId);
  }

  @Post(":updateId/approve")
  async approveBusinessUpdate(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("updateId") updateId: string,
    @Body() body: ApproveUpdateDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.updatesService.approveUpdate({
      businessId,
      updateId,
      approvalNote: body.approvalNote,
    });
  }

  @Post(":updateId/callback-completed")
  async markCallbackCompleted(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("updateId") updateId: string,
    @Body() _body: MarkCallbackCompletedDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.updatesService.markCallbackCompleted({ businessId, updateId });
  }
}
