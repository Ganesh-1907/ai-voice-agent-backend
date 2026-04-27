import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses } from "../database/schema";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { CreateServiceDto } from "./dto/create-service.dto";

type FaqItem = {
  id: string;
  businessId: string;
  question: string;
  answer: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ServiceItem = {
  id: string;
  businessId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class KnowledgeBaseService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async addFaq(businessId: string, dto: CreateFaqDto) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row);
    const currentFaqs = this.getFaqs(metadata);
    const now = new Date().toISOString();

    const faq: FaqItem = {
      id: randomUUID(),
      businessId,
      question: dto.question,
      answer: dto.answer,
      sortOrder: dto.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    metadata.faqs = [...currentFaqs, faq];
    await this.saveMetadata(Number(businessId), metadata);

    return [faq];
  }

  async listFaqs(businessId: string) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row);

    return this.getFaqs(metadata).sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  async addService(businessId: string, dto: CreateServiceDto) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row);
    const currentServices = this.getServices(metadata);
    const now = new Date().toISOString();

    const service: ServiceItem = {
      id: randomUUID(),
      businessId,
      title: dto.title,
      content: dto.content,
      createdAt: now,
      updatedAt: now,
    };

    metadata.services = [...currentServices, service];
    await this.saveMetadata(Number(businessId), metadata);

    return [service];
  }

  async listServices(businessId: string) {
    const row = await this.getBusinessRow(businessId);
    const metadata = this.getMetadata(row);

    return this.getServices(metadata).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async buildBusinessContext(businessId: string) {
    const [faqItems, serviceItems] = await Promise.all([this.listFaqs(businessId), this.listServices(businessId)]);

    const faqContext = faqItems.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n");
    const serviceContext = serviceItems.map((item) => `${item.title}\n${item.content}`).join("\n\n");

    return {
      faqs: faqItems,
      services: serviceItems,
      promptContext: [faqContext, serviceContext].filter(Boolean).join("\n\n"),
    };
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

  private getMetadata(row: { metadata: Record<string, unknown> | null }) {
    return { ...((row.metadata ?? {}) as Record<string, unknown>) };
  }

  private getFaqs(metadata: Record<string, unknown>) {
    const value = metadata.faqs;
    if (!Array.isArray(value)) {
      return [] as FaqItem[];
    }

    return value.filter((item): item is FaqItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as FaqItem).id === "string" &&
        typeof (item as FaqItem).question === "string" &&
        typeof (item as FaqItem).answer === "string"
      );
    });
  }

  private getServices(metadata: Record<string, unknown>) {
    const value = metadata.services;
    if (!Array.isArray(value)) {
      return [] as ServiceItem[];
    }

    return value.filter((item): item is ServiceItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as ServiceItem).id === "string" &&
        typeof (item as ServiceItem).title === "string" &&
        typeof (item as ServiceItem).content === "string"
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
