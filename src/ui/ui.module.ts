import { Module } from "@nestjs/common";

import { UsersService } from "../users/users.service";
import { UiController } from "./ui.controller";
import { UiService } from "./ui.service";

@Module({
  controllers: [UiController],
  providers: [UiService, UsersService],
})
export class UiModule {}
