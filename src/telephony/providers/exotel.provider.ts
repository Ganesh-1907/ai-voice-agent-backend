import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ExotelProvider {
  private readonly logger = new Logger(ExotelProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async connectCallToAiAgent(input: {
    exotelCallSid?: string;
    businessNumber?: string;
    customerNumber?: string;
  }) {
    const sid = this.configService.get<string>("EXOTEL_SID");
    const virtualNumber =
      this.configService.get<string>("CENTRAL_AGENT_NUMBER") ??
      this.configService.get<string>("EXOTEL_VIRTUAL_NUMBER");

    if (!sid || !virtualNumber) {
      this.logger.warn("Exotel is not fully configured; returning simulated routing");
      return {
        routed: false,
        routeTarget: "simulated-ai-agent",
        input,
      };
    }

    return {
      routed: true,
      routeTarget: virtualNumber,
      mode: "central-agent-number",
      input,
    };
  }
}
