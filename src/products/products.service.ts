import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { productFeatures, productImages, products } from "../database/schema";
import { CreateProductImageDto } from "./dto/create-product-image.dto";
import { CreateProductDto, ProductFeatureDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listByBusiness(businessId: string) {
    const rows = await this.database.db
      .select()
      .from(products)
      .where(eq(products.businessId, Number(businessId)))
      .orderBy(desc(products.createdAt));

    const productIds = rows.map((row) => row.id);
    const [featuresByProduct, imagesByProduct] = await Promise.all([
      this.getFeaturesByProductIds(productIds),
      this.getImagesByProductIds(productIds),
    ]);

    return rows.map((row) =>
      this.toApiProduct(row, featuresByProduct.get(row.id) ?? [], imagesByProduct.get(row.id) ?? []),
    );
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

    const features = dto.features ?? [];
    await this.replaceFeatures(row.id, features);

    return this.toApiProduct(row, features, []);
  }

  async update(businessId: string, productId: string, dto: UpdateProductDto) {
    await this.assertBusinessProduct(productId, businessId);

    const [existing] = await this.database.db
      .select()
      .from(products)
      .where(eq(products.id, Number(productId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Product not found for this business");
    }

    const [row] = await this.database.db
      .update(products)
      .set({
        name: dto.name ?? existing.name,
        slug: dto.slug ?? existing.slug,
        description: dto.description ?? existing.description,
        category: dto.category ?? existing.category,
        condition: dto.condition ?? existing.condition,
        status: dto.status ?? existing.status,
        sku: dto.sku ?? existing.sku,
        brand: dto.brand ?? existing.brand,
        model: dto.model ?? existing.model,
        variant: dto.variant ?? existing.variant,
        price: dto.price !== undefined ? String(dto.price) : existing.price,
        discountPrice: dto.discountPrice !== undefined ? String(dto.discountPrice) : existing.discountPrice,
        currency: dto.currency ?? existing.currency,
        stockQuantity: dto.stockQuantity ?? existing.stockQuantity,
        manufactureYear: dto.manufactureYear ?? existing.manufactureYear,
        registrationYear: dto.registrationYear ?? existing.registrationYear,
        purchaseYear: dto.purchaseYear ?? existing.purchaseYear,
        mileageKm: dto.mileageKm ?? existing.mileageKm,
        fuelType: dto.fuelType ?? existing.fuelType,
        transmission: dto.transmission ?? existing.transmission,
        color: dto.color ?? existing.color,
        locationCity: dto.locationCity ?? existing.locationCity,
        locationState: dto.locationState ?? existing.locationState,
        conditionNotes: dto.conditionNotes ?? existing.conditionNotes,
        searchTags: dto.searchTags ?? existing.searchTags,
        specifications: dto.specifications ?? existing.specifications,
        isFeatured: dto.isFeatured ?? existing.isFeatured,
        updatedAt: new Date(),
      })
      .where(eq(products.id, Number(productId)))
      .returning();

    if (dto.features) {
      await this.replaceFeatures(row.id, dto.features);
    }

    const [featuresByProduct, imagesByProduct] = await Promise.all([
      this.getFeaturesByProductIds([row.id]),
      this.getImagesByProductIds([row.id]),
    ]);

    return this.toApiProduct(row, featuresByProduct.get(row.id) ?? [], imagesByProduct.get(row.id) ?? []);
  }

  async delete(businessId: string, productId: string) {
    await this.assertBusinessProduct(productId, businessId);

    await this.database.db.delete(products).where(eq(products.id, Number(productId)));
    return { success: true };
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

    if (dto.isPrimary ?? false) {
      await this.clearPrimaryImage(Number(productId));
    }

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

    return this.toApiImage(row);
  }

  private async getFeaturesByProductIds(productIds: number[]) {
    const featureMap = new Map<number, ProductFeatureDto[]>();
    if (productIds.length === 0) {
      return featureMap;
    }

    const rows = await this.database.db
      .select()
      .from(productFeatures)
      .where(inArray(productFeatures.productId, productIds))
      .orderBy(asc(productFeatures.sortOrder), asc(productFeatures.createdAt));

    for (const row of rows) {
      const current = featureMap.get(row.productId) ?? [];
      current.push({
        key: row.featureName,
        value: row.featureValue,
      });
      featureMap.set(row.productId, current);
    }

    return featureMap;
  }

  private async getImagesByProductIds(productIds: number[]) {
    const imageMap = new Map<number, ReturnType<ProductsService["toApiImage"]>[]>();
    if (productIds.length === 0) {
      return imageMap;
    }

    const rows = await this.database.db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sortOrder), desc(productImages.createdAt));

    for (const row of rows) {
      const current = imageMap.get(row.productId) ?? [];
      current.push(this.toApiImage(row));
      imageMap.set(row.productId, current);
    }

    return imageMap;
  }

  private async replaceFeatures(productId: number, features: ProductFeatureDto[]) {
    await this.database.db.delete(productFeatures).where(eq(productFeatures.productId, productId));

    const normalized = features
      .filter((feature) => feature.key?.trim() && feature.value?.trim())
      .map((feature, index) => ({
        productId,
        featureName: feature.key.trim(),
        featureValue: feature.value.trim(),
        sortOrder: index,
      }));

    if (normalized.length > 0) {
      await this.database.db.insert(productFeatures).values(normalized);
    }
  }

  private async clearPrimaryImage(productId: number) {
    await this.database.db
      .update(productImages)
      .set({
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where(eq(productImages.productId, productId));
  }

  private toApiImage(row: typeof productImages.$inferSelect) {
    return { ...row, id: String(row.id), productId: String(row.productId) };
  }

  private toApiProduct(
    row: typeof products.$inferSelect,
    features: ProductFeatureDto[],
    images: Array<ReturnType<ProductsService["toApiImage"]>>,
  ) {
    const primaryImage = images.find((image) => image.isPrimary) ?? images[0];

    return {
      ...row,
      id: String(row.id),
      businessId: String(row.businessId),
      features,
      images,
      primaryImageUrl: primaryImage?.imageUrl ?? null,
    };
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
