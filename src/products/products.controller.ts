import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CreateProductImageDto } from "./dto/create-product-image.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@ApiBearerAuth()
@Controller("businesses/:businessId/products")
export class ProductsController {
  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUser, @Param("businessId") businessId: string) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.listByBusiness(businessId);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Body() dto: CreateProductDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.create(businessId, dto);
  }

  @Patch(":productId")
  async update(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.update(businessId, productId, dto);
  }

  @Delete(":productId")
  async remove(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("productId") productId: string,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.delete(businessId, productId);
  }

  @Get(":productId/images")
  async listImages(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("productId") productId: string,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.listImages(businessId, productId);
  }

  @Post(":productId/images")
  async addImage(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateProductImageDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.productsService.addImage(businessId, productId, dto);
  }
}
