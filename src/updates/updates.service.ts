import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses, callRequests } from "../database/schema";
import { MessagingService } from "../messaging/messaging.service";

export type BusinessUpdateType = "order" | "preorder" | "book_table" | "callback_request" | "enquiry" | "booking" | "general";
export type BusinessUpdateStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "callback_scheduled"
  | "callback_completed"
  | "called"
  | "not_called";

export type BusinessUpdateRecord = {
  id: string;
  businessId: string;
  callId: string;
  fromNumber: string;
  customerName?: string;
  customerMobile?: string;
  summary: string;
  requestType: BusinessUpdateType;
  status: BusinessUpdateStatus;
  createdAt: string;
  approvedAt?: string;
  approvalNote?: string;
  messagedToCustomer?: boolean;
  messagedAt?: string;
  calledBack?: boolean;
  calledBackAt?: string;
};

@Injectable()
export class UpdatesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MessagingService) private readonly messagingService: MessagingService,
  ) {}

  async listByBusiness(businessId: string) {
    const rows = await this.database.db
      .select()
      .from(callRequests)
      .where(eq(callRequests.businessId, Number(businessId)))
      .orderBy(desc(callRequests.createdAt));

    return rows.map((row) => this.mapCallRequest(row));
  }

  async createFromCall(input: {
    businessId: string;
    callId: string;
    fromNumber: string;
    summary: string;
    transcript: string;
  }) {
    const requestType = this.classifyRequestType(input.summary, input.transcript);
    const customerName = this.extractNameFromTranscript(input.transcript);
    const customerMobile = this.extractValidIndianMobile(input.transcript);
    const now = new Date();

    const [created] = await this.database.db
      .insert(callRequests)
      .values({
        id: randomUUID(),
        callId: input.callId,
        businessId: Number(input.businessId),
        fromNumber: input.fromNumber,
        customerName: customerName ?? null,
        customerMobile: customerMobile ?? null,
        summary: input.summary,
        requestType,
        status: requestType === "callback_request" ? "callback_scheduled" : "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.mapCallRequest(created);
  }

  async approveUpdate(input: {
    businessId: string;
    updateId: string;
    approvalNote?: string;
  }) {
    const [found] = await this.database.db
      .select()
      .from(callRequests)
      .where(and(eq(callRequests.id, input.updateId), eq(callRequests.businessId, Number(input.businessId))))
      .limit(1);

    if (!found) {
      throw new NotFoundException("Update not found");
    }

    const [business] = await this.database.db
      .select({ businessName: businesses.businessName })
      .from(businesses)
      .where(eq(businesses.id, Number(input.businessId)))
      .limit(1);

    const [approvedRow] = await this.database.db
      .update(callRequests)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvalNote: input.approvalNote,
        updatedAt: new Date(),
      })
      .where(eq(callRequests.id, input.updateId))
      .returning();

    const approved = this.mapCallRequest(approvedRow);

    const messageBody = this.createApprovalMessage({
      businessName: business?.businessName ?? `Business ${approved.businessId}`,
      requestType: approved.requestType,
      summary: approved.summary,
      approvalNote: approved.approvalNote,
    });

    const message = await this.messagingService.sendWhatsAppMessage(input.businessId, {
      recipient: approved.customerMobile ?? approved.fromNumber,
      body: messageBody,
      callId: approved.callId,
    });

    const [finalRow] = await this.database.db
      .update(callRequests)
      .set({
        messagedToCustomer: true,
        messagedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(callRequests.id, input.updateId))
      .returning();

    return {
      update: this.mapCallRequest(finalRow),
      whatsapp: message,
    };
  }

  async markCallbackCompleted(input: { businessId: string; updateId: string }) {
    const [updated] = await this.database.db
      .update(callRequests)
      .set({
        calledBack: true,
        calledBackAt: new Date(),
        status: "callback_completed",
        updatedAt: new Date(),
      })
      .where(and(eq(callRequests.id, input.updateId), eq(callRequests.businessId, Number(input.businessId))))
      .returning();

    if (!updated) {
      throw new NotFoundException("Update not found");
    }

    return this.mapCallRequest(updated);
  }

  private classifyRequestType(summary: string, transcript: string): BusinessUpdateType {
    const source = `${summary} ${transcript}`.toLowerCase();

    if (source.includes("callback") || source.includes("call back") || source.includes("call me")) {
      return "callback_request";
    }

    if (
      source.includes("book table") ||
      source.includes("reservation") ||
      source.includes("reserve a table")
    ) {
      return "book_table";
    }

    if (source.includes("pre-order") || source.includes("preorder") || source.includes("coming soon")) {
      return "preorder";
    }

    if (
      source.includes("order") ||
      source.includes("buy") ||
      source.includes("purchase") ||
      source.includes("book this")
    ) {
      return "order";
    }

    return "general";
  }

  private createApprovalMessage(input: {
    businessName: string;
    requestType: BusinessUpdateType;
    summary: string;
    approvalNote?: string;
  }) {
    const verbByType: Record<BusinessUpdateType, string> = {
      order: "order",
      preorder: "pre-order",
      book_table: "booking",
      callback_request: "callback request",
      enquiry: "enquiry",
      booking: "booking",
      general: "request",
    };

    const note = input.approvalNote ? ` Note: ${input.approvalNote}` : "";
    return `Hi, this is ${input.businessName}. Your ${verbByType[input.requestType]} has been approved. Summary: ${input.summary}.${note}`;
  }

  private extractValidIndianMobile(input: string) {
    const matches = input.match(/[\d\s-()+]{8,}/g) ?? [];
    for (const raw of matches) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 10) {
        return digits;
      }
      if (digits.length === 12 && digits.startsWith("91")) {
        return digits.slice(2);
      }
      if (digits.length === 11 && digits.startsWith("0")) {
        return digits.slice(1);
      }
    }

    return null;
  }

  private extractNameFromTranscript(input: string) {
    const pattern = /(?:my name is|i am|this is)\s+([a-z][a-z\s.'-]{1,60})/i;
    const match = input.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    const cleaned = match[1].trim().replace(/\s+/g, " ");
    if (cleaned.length < 2) {
      return null;
    }

    return cleaned
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  private mapCallRequest(row: typeof callRequests.$inferSelect): BusinessUpdateRecord {
    return {
      id: row.id,
      businessId: String(row.businessId),
      callId: row.callId,
      fromNumber: row.fromNumber,
      customerName: row.customerName ?? undefined,
      customerMobile: row.customerMobile ?? undefined,
      summary: row.summary,
      requestType: row.requestType,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
      approvalNote: row.approvalNote ?? undefined,
      messagedToCustomer: row.messagedToCustomer,
      messagedAt: row.messagedAt ? row.messagedAt.toISOString() : undefined,
      calledBack: row.calledBack,
      calledBackAt: row.calledBackAt ? row.calledBackAt.toISOString() : undefined,
    };
  }
}
