import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { productImages, products } from "../database/schema";
import { CreateProductImageDto } from "./dto/create-product-image.dto";
import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listByBusiness(businessId: string) {
    const rows = await this.database.db
      .select()
      .from(products)
      .where(eq(products.businessId, Number(businessId)))
      .orderBy(desc(products.createdAt));

    return rows.map((row) => ({ ...row, id: String(row.id), businessId: String(row.businessId) }));
  }

  async create(businessId: string, dto: CreateProductDto) {
    const [row] = await this.database.db
      .insert(products)
      .values({
        businessId: Number(businessId),
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        category: dto.category,
        condition: dto.condition ?? "used",
        status: dto.status ?? "available",
        sku: dto.sku,
        brand: dto.brand,
        model: dto.model,
        variant: dto.variant,
        price: String(dto.price),
        discountPrice: dto.discountPrice !== undefined ? String(dto.discountPrice) : undefined,
        currency: dto.currency ?? "INR",
        stockQuantity: dto.stockQuantity ?? 1,
        manufactureYear: dto.manufactureYear,
        registrationYear: dto.registrationYear,
        purchaseYear: dto.purchaseYear,
        mileageKm: dto.mileageKm,
        fuelType: dto.fuelType,
        transmission: dto.transmission,
        color: dto.color,
        locationCity: dto.locationCity,
        locationState: dto.locationState,
        conditionNotes: dto.conditionNotes,
        searchTags: dto.searchTags ?? [],
        specifications: dto.specifications ?? {},
        isFeatured: dto.isFeatured ?? false,
      })
      .returning();

    return { ...row, id: String(row.id), businessId: String(row.businessId) };
  }

  async listImages(businessId: string, productId: string) {
    await this.assertBusinessProduct(productId, businessId);

    const rows = await this.database.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, Number(productId)))
      .orderBy(asc(productImages.sortOrder), desc(productImages.createdAt));

    return rows.map((row) => ({ ...row, id: String(row.id), productId: String(row.productId) }));
  }

  async addImage(businessId: string, productId: string, dto: CreateProductImageDto) {
    await this.assertBusinessProduct(productId, businessId);

    const [row] = await this.database.db
      .insert(productImages)
      .values({
        productId: Number(productId),
        imageUrl: dto.imageUrl,
        altText: dto.altText,
        isPrimary: dto.isPrimary ?? false,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();

    return { ...row, id: String(row.id), productId: String(row.productId) };
  }

  private async assertBusinessProduct(productId: string, businessId: string) {
    const [product] = await this.database.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, Number(productId)), eq(products.businessId, Number(businessId))))
      .limit(1);

    if (!product) {
      throw new NotFoundException("Product not found for this business");
    }
  }
}
