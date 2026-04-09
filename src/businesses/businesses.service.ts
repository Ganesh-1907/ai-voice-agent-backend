import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, or } from "drizzle-orm";

import { normalizePhoneNumber } from "../common/utils/phone.util";
import { DatabaseService } from "../database/database.service";
import { businesses } from "../database/schema";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Injectable()
export class BusinessesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  create(ownerUserId: string, dto: CreateBusinessDto) {
    return this.database.db
      .insert(businesses)
      .values({
        ownerUserId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        businessPhoneNumber: dto.businessPhoneNumber,
        virtualPhoneNumber: dto.virtualPhoneNumber,
        exotelNumber: dto.virtualPhoneNumber,
        planCode: dto.planCode ?? "starter",
        settings: dto.settings ?? {},
      })
      .returning();
  }

  listForOwner(ownerUserId: string) {
    return this.database.db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, ownerUserId))
      .orderBy(desc(businesses.createdAt));
  }

  async findOwnedBusinessOrFail(ownerUserId: string, businessId: string) {
    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .limit(1);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async findByIdOrFail(businessId: string) {
    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async update(ownerUserId: string, businessId: string, dto: UpdateBusinessDto) {
    await this.findOwnedBusinessOrFail(ownerUserId, businessId);

    const [business] = await this.database.db
      .update(businesses)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .returning();

    return business;
  }

  async getByRoutingNumber(routingNumber: string) {
    const normalizedRoutingNumber = normalizePhoneNumber(routingNumber);
    const [business] = await this.database.db
      .select()
      .from(businesses)
      .where(
        or(
          eq(businesses.businessPhoneNumber, routingNumber),
          eq(businesses.businessPhoneNumber, normalizedRoutingNumber),
          eq(businesses.virtualPhoneNumber, routingNumber),
          eq(businesses.virtualPhoneNumber, normalizedRoutingNumber),
          eq(businesses.exotelNumber, routingNumber),
          eq(businesses.exotelNumber, normalizedRoutingNumber),
        ),
      )
      .limit(1);

    return business ?? null;
  }

  getAgentGreeting(business: typeof businesses.$inferSelect) {
    const configuredGreeting =
      typeof business.settings.welcomeMessage === "string"
        ? business.settings.welcomeMessage.trim()
        : "";

    if (configuredGreeting) {
      return configuredGreeting;
    }

    return `Welcome to ${business.name}. How may I help you today?`;
  }

  async assertAccess(ownerUserId: string, businessId: string) {
    const business = await this.findOwnedBusinessOrFail(ownerUserId, businessId);
    if (business.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("You do not have access to this business");
    }
    return business;
  }
}
