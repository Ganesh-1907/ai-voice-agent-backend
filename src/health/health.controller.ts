import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../common/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "ai-call-handling-backend",
      timestamp: new Date().toISOString(),
    };
  }
}
