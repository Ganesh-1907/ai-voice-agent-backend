import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, or } from "drizzle-orm";

import { normalizePhoneNumber } from "../common/utils/phone.util";
import { DatabaseService } from "../database/database.service";
import { businesses, users } from "../database/schema";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Injectable()
export class BusinessesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(ownerUserId: string, dto: CreateBusinessDto) {
    const owner = await this.getOwnerUserOrFail(ownerUserId);

    const [business] = await this.database.db
      .insert(businesses)
      .values({
        businessName: dto.name,
        slug: dto.slug,
        serviceType:
          dto.settings?.serviceType === "car_dealer" ||
          dto.settings?.serviceType === "appliance_store" ||
          dto.settings?.serviceType === "electronics_store" ||
          dto.settings?.serviceType === "other"
            ? dto.settings.serviceType
            : "mixed_inventory",
        contactNumber: dto.businessPhoneNumber,
        primaryEmail: typeof dto.settings?.primaryEmail === "string" ? dto.settings.primaryEmail : undefined,
        primaryMobile: dto.virtualPhoneNumber,
        city: typeof dto.settings?.city === "string" ? dto.settings.city : undefined,
        state: typeof dto.settings?.state === "string" ? dto.settings.state : undefined,
        address: typeof dto.settings?.address === "string" ? dto.settings.address : undefined,
        metadata: {
          ...(dto.settings ?? {}),
          planCode: dto.planCode ?? "starter",
          description: dto.description ?? null,
        },
      })
      .returning();

    await this.database.db
      .update(users)
      .set({
        businessId: business.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, owner.id));

    return [this.toApiBusiness(business)];
  }

  async listForOwner(ownerUserId: string) {
    const owner = await this.getOwnerUserOrFail(ownerUserId);

    const rows = await this.database.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, owner.businessId))
      .orderBy(desc(businesses.createdAt));

    return rows.map((row) => this.toApiBusiness(row));
  }

  async findOwnedBusinessOrFail(ownerUserId: string, businessId: string) {
    const owner = await this.getOwnerUserOrFail(ownerUserId);
    const businessIdNum = Number(businessId);

    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessIdNum), eq(businesses.id, owner.businessId)))
      .limit(1);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return this.toApiBusiness(business);
  }

  async findByIdOrFail(businessId: string) {
    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, Number(businessId)))
      .limit(1);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return this.toApiBusiness(business);
  }

  async update(ownerUserId: string, businessId: string, dto: UpdateBusinessDto) {
    const existing = await this.findOwnedBusinessOrFail(ownerUserId, businessId);

    const mergedSettings: Record<string, unknown> = {
      ...(existing.settings ?? {}),
      ...(dto.settings ?? {}),
      planCode: dto.planCode ?? existing.planCode ?? "starter",
      description: dto.description ?? existing.description ?? null,
    };

    const [business] = await this.database.db
      .update(businesses)
      .set({
        businessName: dto.name ?? existing.name,
        slug: dto.slug ?? existing.slug,
        serviceType:
          dto.settings?.serviceType === "car_dealer" ||
          dto.settings?.serviceType === "appliance_store" ||
          dto.settings?.serviceType === "electronics_store" ||
          dto.settings?.serviceType === "other" ||
          dto.settings?.serviceType === "mixed_inventory"
            ? dto.settings.serviceType
            : existing.serviceType ?? "mixed_inventory",
        contactNumber: dto.businessPhoneNumber ?? existing.businessPhoneNumber,
        primaryEmail:
          typeof dto.settings?.primaryEmail === "string"
            ? dto.settings.primaryEmail
            : existing.primaryEmail ?? undefined,
        primaryMobile: dto.virtualPhoneNumber ?? existing.virtualPhoneNumber ?? undefined,
        city: typeof dto.settings?.city === "string" ? dto.settings.city : existing.city ?? undefined,
        state: typeof dto.settings?.state === "string" ? dto.settings.state : existing.state ?? undefined,
        address: typeof dto.settings?.address === "string" ? dto.settings.address : existing.address ?? undefined,
        metadata: mergedSettings,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, Number(businessId)))
      .returning();

    return this.toApiBusiness(business);
  }

  async getByRoutingNumber(routingNumber: string) {
    const normalizedRoutingNumber = normalizePhoneNumber(routingNumber);
    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(
        or(
          eq(businesses.contactNumber, routingNumber),
          eq(businesses.contactNumber, normalizedRoutingNumber),
          eq(businesses.primaryMobile, routingNumber),
          eq(businesses.primaryMobile, normalizedRoutingNumber),
        ),
      )
      .limit(1);

    return business ? this.toApiBusiness(business) : null;
  }

  getAgentGreeting(business: ReturnType<BusinessesService["toApiBusiness"]>) {
    const configuredGreeting =
      typeof business.settings.welcomeMessage === "string"
        ? String(business.settings.welcomeMessage).trim()
        : "";

    if (configuredGreeting) {
      return configuredGreeting;
    }

    return `Welcome to ${business.name}. How may I help you today?`;
  }

  async assertAccess(ownerUserId: string, businessId: string) {
    const business = await this.findOwnedBusinessOrFail(ownerUserId, businessId);
    const owner = await this.getOwnerUserOrFail(ownerUserId);

    if (String(owner.businessId) !== String(business.id)) {
      throw new ForbiddenException("You do not have access to this business");
    }

    return business;
  }

  private async getOwnerUserOrFail(ownerUserId: string) {
    const [owner] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, Number(ownerUserId)))
      .limit(1);

    if (!owner) {
      throw new NotFoundException("User not found");
    }

    return owner;
  }

  private toApiBusiness(row: typeof businesses.$inferSelect) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;

    return {
      id: String(row.id),
      name: row.businessName,
      slug: row.slug,
      serviceType: row.serviceType,
      description: typeof metadata.description === "string" ? metadata.description : null,
      businessPhoneNumber: row.contactNumber,
      primaryEmail: row.primaryEmail ?? null,
      primaryMobile: row.primaryMobile ?? null,
      virtualPhoneNumber: row.primaryMobile ?? null,
      exotelNumber: row.primaryMobile ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      address: row.address ?? null,
      planCode:
        metadata.planCode === "growth" || metadata.planCode === "pro" ? metadata.planCode : "starter",
      isActive: row.voiceAgentEnabled,
      settings: metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
