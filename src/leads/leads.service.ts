import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses } from "../database/schema";
import { CreateLeadDto } from "./dto/create-lead.dto";

type LeadItem = {
  id: string;
  businessId: string;
  callId?: string;
  name?: string;
  phone: string;
  intent?: string;
  notes?: string;
  status: "new" | "contacted" | "qualified" | "lost";
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class LeadsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(businessId: string, dto: CreateLeadDto, callId?: string) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row.metadata);
    const leads = this.getLeads(metadata);
    const now = new Date().toISOString();

    const lead: LeadItem = {
      id: crypto.randomUUID(),
      businessId,
      callId,
      name: dto.name,
      phone: dto.phone,
      intent: dto.intent,
      notes: dto.notes,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    metadata.leads = [lead, ...leads];
    await this.saveMetadata(row.id, metadata);

    return [lead];
  }

  async listByBusiness(businessId: string) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row.metadata);

    return this.getLeads(metadata).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async getBusinessRow(businessId: string) {
    const [row] = await this.database.db
      .select({ id: businesses.id, metadata: businesses.metadata })
      .from(businesses)
      .where(eq(businesses.id, Number(businessId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Business not found");
    }

    return row;
  }

  private getMetadata(raw: Record<string, unknown> | null) {
    return { ...((raw ?? {}) as Record<string, unknown>) };
  }

  private getLeads(metadata: Record<string, unknown>) {
    const value = metadata.leads;
    if (!Array.isArray(value)) {
      return [] as LeadItem[];
    }

    return value.filter((item): item is LeadItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as LeadItem).id === "string" &&
        typeof (item as LeadItem).phone === "string"
      );
    });
  }

  private async saveMetadata(businessId: number, metadata: Record<string, unknown>) {
    await this.database.db
      .update(businesses)
      .set({
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));
  }
}
