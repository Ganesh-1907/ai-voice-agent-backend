import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { whatsappMessages, orders } from "../database/schema";
import { WhatsAppProvider } from "./providers/whatsapp.provider";
import { WhatsAppSessionStore } from "./whatsapp-session.store";
import type { WhatsAppSession } from "./whatsapp-session.store";

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(WhatsAppProvider) private readonly whatsappProvider: WhatsAppProvider,
    @Inject(WhatsAppSessionStore) private readonly sessionStore: WhatsAppSessionStore,
  ) {}

  isWhatsAppConfigured(): boolean {
    return this.whatsappProvider.isConfigured();
  }

  // ─── Post-Call Follow-Up (auto-triggered after call completion) ────────────

  async sendPostCallFollowUp(input: {
    businessId: string;
    businessName: string;
    callId: string;
    customerPhone: string;
    callSummary: string;
    productsAsked: Array<{ id: string; name: string; imageUrl?: string }>;
    hasOrder: boolean;
    orderProductId?: string;
    orderProductName?: string;
    orderProductImageUrl?: string;
  }) {
    if (!this.whatsappProvider.isConfigured()) {
      this.logger.warn("WhatsApp not configured; skipping post-call follow-up");
      return { sent: false, reason: "not_configured" };
    }

    const session = this.sessionStore.createSession({
      customerPhone: input.customerPhone,
      businessId: input.businessId,
      callId: input.callId,
      callSummary: input.callSummary,
      productsAsked: input.productsAsked,
    });

    if (input.hasOrder && input.orderProductId) {
      // Order path: send order summary + confirmation buttons
      session.currentStep = "confirm_order";
      session.pendingOrderProductId = input.orderProductId;
      session.pendingOrderProductName = input.orderProductName;
      this.sessionStore.set(input.customerPhone, session);

      if (input.orderProductImageUrl) {
        await this.sendAndStoreImage(
          input.businessId,
          input.callId,
          input.customerPhone,
          input.orderProductImageUrl,
          `📦 ${input.orderProductName}`,
        );
      }

      const summaryText = [
        `🛒 *Order Summary*`,
        ``,
        `Thank you for calling ${input.businessName}!`,
        ``,
        `*Product:* ${input.orderProductName}`,
        ``,
        `*Call Summary:*`,
        input.callSummary,
      ].join("\n");

      await this.sendAndStoreInteractive(
        input.businessId,
        input.callId,
        input.customerPhone,
        summaryText,
        [
          { id: "confirm_order_yes", title: "✅ Confirm Order" },
          { id: "confirm_order_no", title: "❌ Cancel" },
        ],
        "Order Confirmation",
        "Please choose an option",
      );

      return { sent: true, step: "confirm_order" };
    }

    // Enquiry path: send call summary + options
    session.currentStep = "post_call_menu";
    this.sessionStore.set(input.customerPhone, session);

    const summaryText = [
      `📞 *Call Summary*`,
      ``,
      `Thank you for calling ${input.businessName}!`,
      ``,
      input.callSummary,
    ].join("\n");

    const buttons = [
      { id: "action_order", title: "🛒 Order Item" },
      { id: "action_details", title: "📋 View Details" },
    ];

    await this.sendAndStoreInteractive(
      input.businessId,
      input.callId,
      input.customerPhone,
      summaryText,
      buttons,
      "Post-Call Follow-Up",
      "Please choose an option",
    );

    return { sent: true, step: "post_call_menu" };
  }

  // ─── Handle Incoming Button Reply from WhatsApp ───────────────────────────

  async handleUserButtonReply(customerPhone: string, buttonId: string): Promise<void> {
    const session = this.sessionStore.get(customerPhone);
    if (!session) {
      const lastMessage = await this.database.db.query.whatsappMessages.findFirst({
        where: eq(whatsappMessages.customerPhone, customerPhone),
        orderBy: [desc(whatsappMessages.createdAt)],
      });
      const bizId = lastMessage ? String(lastMessage.businessId) : "1"; // Fallback to 1 if not found

      await this.sendAndStoreText(
        bizId,
        null,
        customerPhone,
        "Your session has expired. Please call us again for assistance.",
      );
      return;
    }

    this.logger.log(`Button reply: phone=${customerPhone} button=${buttonId} step=${session.currentStep}`);

    switch (buttonId) {
      case "action_order":
        await this.handleActionOrder(session);
        break;
      case "action_details":
        await this.handleActionDetails(session);
        break;
      case "confirm_order_yes":
        await this.handleConfirmOrderYes(session);
        break;
      case "confirm_order_no":
        await this.handleConfirmOrderNo(session);
        break;
      case "action_order_this":
        await this.handleOrderThisProduct(session);
        break;
      case "action_back_menu":
        await this.handleBackToMenu(session);
        break;
      default:
        // Handle product selection buttons (product_<id>)
        if (buttonId.startsWith("product_")) {
          await this.handleProductSelection(session, buttonId);
        } else {
          await this.sendChooseOptionReminder(session);
        }
        break;
    }
  }

  // Handle when user sends free text instead of choosing a button
  async handleFreeTextMessage(customerPhone: string): Promise<void> {
    const session = this.sessionStore.get(customerPhone);
    if (!session) {
      const lastMessage = await this.database.db.query.whatsappMessages.findFirst({
        where: eq(whatsappMessages.customerPhone, customerPhone),
        orderBy: [desc(whatsappMessages.createdAt)],
      });
      const bizId = lastMessage ? String(lastMessage.businessId) : "1";

      await this.sendAndStoreText(
        bizId,
        null,
        customerPhone,
        "Thank you for your message. Please call us for assistance, and we'll follow up here on WhatsApp.",
      );
      return;
    }

    await this.sendChooseOptionReminder(session);
  }

  // ─── Specific action handlers ─────────────────────────────────────────────

  private async handleActionOrder(session: WhatsAppSession) {
    if (session.productsAsked.length === 0) {
      await this.sendAndStoreInteractive(
        session.businessId,
        session.callId,
        session.customerPhone,
        "No specific products were discussed during your call. Please call us again to enquire about products you'd like to order.",
        [{ id: "action_back_menu", title: "↩️ Back to Menu" }],
      );
      return;
    }

    session.currentStep = "select_product";
    this.sessionStore.set(session.customerPhone, session);

    const buttons = session.productsAsked.slice(0, 3).map((p) => ({
      id: `product_${p.id}`,
      title: p.name.slice(0, 20),
    }));

    await this.sendAndStoreInteractive(
      session.businessId,
      session.callId,
      session.customerPhone,
      "Which product would you like to order?",
      buttons,
      "Select Product",
    );
  }

  private async handleActionDetails(session: WhatsAppSession) {
    if (session.productsAsked.length === 0) {
      await this.sendAndStoreInteractive(
        session.businessId,
        session.callId,
        session.customerPhone,
        "No specific products were discussed during your call. Please call us again for product details.",
        [{ id: "action_back_menu", title: "↩️ Back to Menu" }],
      );
      return;
    }

    session.currentStep = "view_product_detail";
    this.sessionStore.set(session.customerPhone, session);

    // Send details for each product discussed
    for (const product of session.productsAsked) {
      if (product.imageUrl) {
        await this.sendAndStoreImage(
          session.businessId,
          session.callId,
          session.customerPhone,
          product.imageUrl,
          product.name,
        );
      }

      await this.sendAndStoreText(
        session.businessId,
        session.callId,
        session.customerPhone,
        `📦 *${product.name}*\n\nThis product was discussed during your call. Contact us for detailed pricing and specifications.`,
      );
    }

    // After showing details, offer to order or go back
    const firstProduct = session.productsAsked[0];
    session.pendingOrderProductId = firstProduct.id;
    session.pendingOrderProductName = firstProduct.name;
    this.sessionStore.set(session.customerPhone, session);

    await this.sendAndStoreInteractive(
      session.businessId,
      session.callId,
      session.customerPhone,
      "Would you like to place an order for any of these products?",
      [
        { id: "action_order_this", title: "🛒 Order This" },
        { id: "action_back_menu", title: "↩️ Back to Menu" },
      ],
    );
  }

  private async handleProductSelection(session: WhatsAppSession, buttonId: string) {
    const productId = buttonId.replace("product_", "");
    const product = session.productsAsked.find((p) => p.id === productId);

    if (!product) {
      await this.sendChooseOptionReminder(session);
      return;
    }

    session.currentStep = "confirm_order";
    session.pendingOrderProductId = product.id;
    session.pendingOrderProductName = product.name;
    this.sessionStore.set(session.customerPhone, session);

    if (product.imageUrl) {
      await this.sendAndStoreImage(
        session.businessId,
        session.callId,
        session.customerPhone,
        product.imageUrl,
        `📦 ${product.name}`,
      );
    }

    await this.sendAndStoreInteractive(
      session.businessId,
      session.callId,
      session.customerPhone,
      `🛒 *Order Summary*\n\n*Product:* ${product.name}\n\nCan we confirm this order?`,
      [
        { id: "confirm_order_yes", title: "✅ Confirm Order" },
        { id: "confirm_order_no", title: "❌ Cancel" },
      ],
      "Confirm Order",
    );
  }

  private async handleOrderThisProduct(session: WhatsAppSession) {
    if (!session.pendingOrderProductId || !session.pendingOrderProductName) {
      await this.sendChooseOptionReminder(session);
      return;
    }

    session.currentStep = "confirm_order";
    this.sessionStore.set(session.customerPhone, session);

    await this.sendAndStoreInteractive(
      session.businessId,
      session.callId,
      session.customerPhone,
      `🛒 *Order Summary*\n\n*Product:* ${session.pendingOrderProductName}\n\nCan we confirm this order?`,
      [
        { id: "confirm_order_yes", title: "✅ Confirm Order" },
        { id: "confirm_order_no", title: "❌ Cancel" },
      ],
      "Confirm Order",
    );
  }

  private async handleConfirmOrderYes(session: WhatsAppSession) {
    session.currentStep = "completed";
    this.sessionStore.set(session.customerPhone, session);

    try {
      await this.database.db.insert(orders).values({
        businessId: Number(session.businessId),
        callId: session.callId,
        productId: session.pendingOrderProductId ? Number(session.pendingOrderProductId) : null,
        customerNumber: session.customerPhone,
        status: "accepted",
        summary: "Order confirmed via WhatsApp",
      });
      this.logger.log(`Created order for phone=${session.customerPhone} product=${session.pendingOrderProductId}`);
    } catch (err) {
      this.logger.error("Failed to create order upon confirmation", err);
    }

    await this.sendAndStoreText(
      session.businessId,
      session.callId,
      session.customerPhone,
      [
        `✅ *Order Confirmed!*`,
        ``,
        `*Product:* ${session.pendingOrderProductName ?? "Selected product"}`,
        ``,
        `Your order has been placed successfully. Our team will contact you shortly with further details.`,
        ``,
        `Thank you for choosing us! 🙏`,
      ].join("\n"),
    );

    this.sessionStore.delete(session.customerPhone);
  }

  private async handleConfirmOrderNo(session: WhatsAppSession) {
    session.currentStep = "completed";
    this.sessionStore.set(session.customerPhone, session);

    await this.sendAndStoreText(
      session.businessId,
      session.callId,
      session.customerPhone,
      "❌ Order cancelled. Thank you for your interest! Feel free to call us again anytime.",
    );

    this.sessionStore.delete(session.customerPhone);
  }

  private async handleBackToMenu(session: WhatsAppSession) {
    session.currentStep = "post_call_menu";
    this.sessionStore.set(session.customerPhone, session);

    await this.sendAndStoreInteractive(
      session.businessId,
      session.callId,
      session.customerPhone,
      "How can we help you?",
      [
        { id: "action_order", title: "🛒 Order Item" },
        { id: "action_details", title: "📋 View Details" },
      ],
      "Menu",
    );
  }

  private async sendChooseOptionReminder(session: WhatsAppSession) {
    await this.sendAndStoreText(
      session.businessId,
      session.callId,
      session.customerPhone,
      "⚠️ Please choose one of the options from the buttons above instead of sending a message.",
    );
  }

  // ─── Message History & Resend ─────────────────────────────────────────────

  async getMessageHistory(businessId: string, limit = 50, offset = 0) {
    const rows = await this.database.db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.businessId, Number(businessId)))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.mapMessage(row));
  }

  async resendMessage(businessId: string, messageId: string) {
    const [msg] = await this.database.db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.id, messageId),
          eq(whatsappMessages.businessId, Number(businessId)),
        ),
      )
      .limit(1);

    if (!msg) {
      throw new NotFoundException("Message not found");
    }

    let result: { delivered: boolean; providerMessageId: string | null; status: string };

    if (msg.messageType === "interactive" && msg.buttonPayload) {
      const payload = msg.buttonPayload as {
        buttons?: Array<{ id: string; title: string }>;
        headerText?: string;
        footerText?: string;
      };
      result = await this.whatsappProvider.sendInteractiveButtons(
        msg.customerPhone,
        msg.body ?? "",
        payload.buttons ?? [],
        payload.headerText,
        payload.footerText,
      );
    } else if (msg.messageType === "image") {
      result = await this.whatsappProvider.sendImageMessage(
        msg.customerPhone,
        msg.body ?? "",
      );
    } else {
      result = await this.whatsappProvider.sendTextMessage(msg.customerPhone, msg.body ?? "");
    }

    await this.database.db
      .update(whatsappMessages)
      .set({
        status: result.delivered ? "sent" : "failed",
        providerMessageId: result.providerMessageId,
        updatedAt: new Date(),
      })
      .where(eq(whatsappMessages.id, messageId));

    return {
      messageId,
      delivered: result.delivered,
      status: result.status,
    };
  }

  // ─── Update Delivery Status (from webhook) ───────────────────────────────

  async updateMessageStatus(providerMessageId: string, status: "sent" | "delivered" | "read" | "failed", errorMessage?: string) {
    const [msg] = await this.database.db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.providerMessageId, providerMessageId))
      .limit(1);

    if (!msg) {
      return;
    }

    // Only update forward (queued→sent→delivered→read), never backward
    const statusOrder = { queued: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
    const currentOrder = statusOrder[msg.status] ?? 0;
    const newOrder = statusOrder[status] ?? 0;

    if (status === "failed" || newOrder > currentOrder) {
      await this.database.db
        .update(whatsappMessages)
        .set({
          status,
          errorMessage: errorMessage ?? msg.errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, msg.id));
    }
  }

  // ─── Legacy follow-up message generator ───────────────────────────────────

  generateFollowUpMessage(input: { businessName: string; summary?: string; leadName?: string }) {
    const greeting = input.leadName ? `Hi ${input.leadName}` : "Hi";
    const summaryLine = input.summary
      ? ` Thanks for speaking with ${input.businessName}. Here is a quick recap: ${input.summary}.`
      : ` Thanks for speaking with ${input.businessName}.`;

    return `${greeting}.${summaryLine} Reply to this WhatsApp message if you would like us to help you further.`;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  async sendAndStoreText(
    businessId: string,
    callId: string | null,
    customerPhone: string,
    body: string,
  ) {
    const id = randomUUID();
    const result = await this.whatsappProvider.sendTextMessage(customerPhone, body);

    await this.database.db.insert(whatsappMessages).values({
      id,
      businessId: businessId ? Number(businessId) : 0,
      callId: callId || null,
      customerPhone,
      direction: "outbound",
      messageType: "text",
      body,
      providerMessageId: result.providerMessageId,
      status: result.delivered ? "sent" : result.status === "not_configured" ? "queued" : "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id, ...result };
  }

  private async sendAndStoreInteractive(
    businessId: string,
    callId: string,
    customerPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string,
  ) {
    const id = randomUUID();
    const result = await this.whatsappProvider.sendInteractiveButtons(
      customerPhone,
      bodyText,
      buttons,
      headerText,
      footerText,
    );

    await this.database.db.insert(whatsappMessages).values({
      id,
      businessId: businessId ? Number(businessId) : 0,
      callId: callId || null,
      customerPhone,
      direction: "outbound",
      messageType: "interactive",
      body: bodyText,
      buttonPayload: { buttons, headerText, footerText },
      providerMessageId: result.providerMessageId,
      status: result.delivered ? "sent" : result.status === "not_configured" ? "queued" : "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id, ...result };
  }

  private async sendAndStoreImage(
    businessId: string,
    callId: string,
    customerPhone: string,
    imageUrl: string,
    caption?: string,
  ) {
    const id = randomUUID();
    const result = await this.whatsappProvider.sendImageMessage(customerPhone, imageUrl, caption);

    await this.database.db.insert(whatsappMessages).values({
      id,
      businessId: businessId ? Number(businessId) : 0,
      callId: callId || null,
      customerPhone,
      direction: "outbound",
      messageType: "image",
      body: imageUrl,
      buttonPayload: caption ? { caption } : undefined,
      providerMessageId: result.providerMessageId,
      status: result.delivered ? "sent" : result.status === "not_configured" ? "queued" : "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id, ...result };
  }

  private mapMessage(row: typeof whatsappMessages.$inferSelect) {
    return {
      id: row.id,
      businessId: String(row.businessId),
      callId: row.callId,
      customerPhone: row.customerPhone,
      direction: row.direction,
      messageType: row.messageType,
      body: row.body,
      buttonPayload: row.buttonPayload,
      providerMessageId: row.providerMessageId,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
