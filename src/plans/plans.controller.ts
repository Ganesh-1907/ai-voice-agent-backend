import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";
import { PlansService } from "./plans.service";

@ApiTags("Plans")
@Controller("plans")
export class PlansController {
  constructor(@Inject(PlansService) private readonly plansService: PlansService) {}

  @Public()
  @Get()
  list() {
    return this.plansService.listPlans();
  }
}
