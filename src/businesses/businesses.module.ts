import { Module } from "@nestjs/common";

import { UsersService } from "../users/users.service";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";

@Module({
  controllers: [BusinessesController],
  providers: [BusinessesService, UsersService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
