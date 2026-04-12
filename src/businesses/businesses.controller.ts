import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { UsersService } from "../users/users.service";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@ApiTags("Businesses")
@ApiBearerAuth()
@Controller("businesses")
export class BusinessesController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateBusinessDto) {
    const [business] = await this.businessesService.create(user.sub, dto);
    return business;
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.businessesService.listForOwner(user.sub);
  }

  @Get(":businessId")
  getOne(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    return this.businessesService.findOwnedBusinessOrFail(user.sub, businessId);
  }

  @Get(":businessId/users")
  async getBusinessUsers(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.usersService.listByBusiness(businessId);
  }

  @Patch(":businessId")
  update(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessesService.update(user.sub, businessId, dto);
  }
}
