import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { faqs, services } from "../database/schema";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { CreateServiceDto } from "./dto/create-service.dto";

@Injectable()
export class KnowledgeBaseService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  addFaq(businessId: string, dto: CreateFaqDto) {
    return this.database.db
      .insert(faqs)
      .values({
        businessId,
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
  }

  listFaqs(businessId: string) {
    return this.database.db
      .select()
      .from(faqs)
      .where(eq(faqs.businessId, businessId))
      .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt));
  }

  addService(businessId: string, dto: CreateServiceDto) {
    return this.database.db
      .insert(services)
      .values({
        businessId,
        title: dto.title,
        content: dto.content,
      })
      .returning();
  }

  listServices(businessId: string) {
    return this.database.db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(asc(services.createdAt));
  }

  async buildBusinessContext(businessId: string) {
    const [faqItems, serviceItems] = await Promise.all([
      this.listFaqs(businessId),
      this.listServices(businessId),
    ]);

    const faqContext = faqItems.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n");
    const serviceContext = serviceItems
      .map((item) => `${item.title}\n${item.content}`)
      .join("\n\n");

    return {
      faqs: faqItems,
      services: serviceItems,
      promptContext: [faqContext, serviceContext].filter(Boolean).join("\n\n"),
    };
  }
}
