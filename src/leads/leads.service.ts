import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { leads } from "../database/schema";
import { CreateLeadDto } from "./dto/create-lead.dto";

@Injectable()
export class LeadsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  create(businessId: string, dto: CreateLeadDto, callId?: string) {
    return this.database.db
      .insert(leads)
      .values({
        businessId,
        callId,
        name: dto.name,
        phone: dto.phone,
        intent: dto.intent,
        notes: dto.notes,
      })
      .returning();
  }

  listByBusiness(businessId: string) {
    return this.database.db
      .select()
      .from(leads)
      .where(eq(leads.businessId, businessId))
      .orderBy(desc(leads.createdAt));
  }
}
