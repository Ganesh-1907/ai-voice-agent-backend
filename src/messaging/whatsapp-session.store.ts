import { Injectable } from "@nestjs/common";

export type WhatsAppSessionStep =
  | "post_call_menu"
  | "select_product"
  | "view_product_detail"
  | "confirm_order"
  | "completed";

export interface WhatsAppSession {
  customerPhone: string;
  businessId: string;
  callId: string;
  currentStep: WhatsAppSessionStep;
  callSummary?: string;
  productsAsked: Array<{ id: string; name: string; imageUrl?: string }>;
  pendingOrderProductId?: string;
  pendingOrderProductName?: string;
  createdAt: number;
  updatedAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class WhatsAppSessionStore {
  private readonly sessions = new Map<string, WhatsAppSession>();

  set(customerPhone: string, session: WhatsAppSession): void {
    const key = this.normalizeKey(customerPhone);
    session.updatedAt = Date.now();
    this.sessions.set(key, session);
  }

  get(customerPhone: string): WhatsAppSession | null {
    const key = this.normalizeKey(customerPhone);
    const session = this.sessions.get(key);
    if (!session) {
      return null;
    }

    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(key);
      return null;
    }

    return session;
  }

  update(customerPhone: string, updates: Partial<WhatsAppSession>): WhatsAppSession | null {
    const session = this.get(customerPhone);
    if (!session) {
      return null;
    }

    const updated = { ...session, ...updates, updatedAt: Date.now() };
    this.sessions.set(this.normalizeKey(customerPhone), updated);
    return updated;
  }

  delete(customerPhone: string): void {
    this.sessions.delete(this.normalizeKey(customerPhone));
  }

  createSession(input: {
    customerPhone: string;
    businessId: string;
    callId: string;
    callSummary?: string;
    productsAsked: Array<{ id: string; name: string; imageUrl?: string }>;
  }): WhatsAppSession {
    const session: WhatsAppSession = {
      customerPhone: input.customerPhone,
      businessId: input.businessId,
      callId: input.callId,
      currentStep: "post_call_menu",
      callSummary: input.callSummary,
      productsAsked: input.productsAsked,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.set(input.customerPhone, session);
    return session;
  }

  private normalizeKey(phone: string): string {
    return phone.replace(/\D/g, "").replace(/^0+/, "");
  }
}
