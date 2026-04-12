import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { products } from "../database/schema";
import { KnowledgeBaseService } from "../knowledge-base/knowledge-base.service";
import { ElevenLabsProvider } from "./providers/elevenlabs.provider";
import { OpenAiProvider } from "./providers/openai.provider";

type CallBusinessContext = {
  id: string;
  name: string;
  description?: string | null;
  businessPhoneNumber: string;
  virtualPhoneNumber?: string | null;
  serviceType?: string | null;
  primaryEmail?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  settings: Record<string, unknown>;
};

type ProductSnapshot = {
  id: string;
  name: string;
  category: string;
  status: string;
  price: string;
  currency: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
};

@Injectable()
export class AiService {
  private readonly snapshotCache = new Map<
    string,
    {
      expiresAt: number;
      context: Awaited<ReturnType<KnowledgeBaseService["buildBusinessContext"]>>;
      inventory: ProductSnapshot[];
    }
  >();

  constructor(
    @Inject(KnowledgeBaseService) private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(OpenAiProvider) private readonly openAiProvider: OpenAiProvider,
    @Inject(ElevenLabsProvider) private readonly elevenLabsProvider: ElevenLabsProvider,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async processCallTurn(business: CallBusinessContext, customerText: string, conversationContext = "") {
    const { context, inventory } = await this.getBusinessSnapshot(business.id);

    const groundedReply = this.tryGroundedReply(
      business,
      customerText,
      context,
      inventory,
      conversationContext,
    );

    if (groundedReply) {
      const speech = await this.elevenLabsProvider.textToSpeech(groundedReply);
      return {
        inputText: customerText,
        replyText: groundedReply,
        audioBase64: speech.audioBase64,
      };
    }

    const systemPrompt = [
      `You are an AI voice agent for ${business.name}.`,
      "Use only schema-backed data provided below (business profile + inventory + FAQ/services).",
      "Never invent contact details, location, inventory counts, models, or prices.",
      "If data is not present, say so clearly and offer human follow-up.",
      "Talk like a warm human representative in a natural 2-person conversation.",
      "Avoid robotic language and avoid saying you are an AI.",
      "Keep response short and phone-call friendly.",
      "Never restart with a fresh greeting in the middle of an ongoing call.",
      "For INR prices, speak naturally using Indian units like lakh and thousand.",
      "Conversation so far:\n" + (conversationContext || "No prior turns"),
      "Business profile:\n" + this.buildBusinessProfileText(business),
      "Inventory summary:\n" + this.buildInventoryContext(inventory),
      "FAQ/Services context:\n" + this.buildRelevantKnowledgeContext(customerText, context),
    ].join("\n\n");

    const reply = await this.openAiProvider.generateReply(systemPrompt, customerText);
    const speech = await this.elevenLabsProvider.textToSpeech(reply.text);

    return {
      inputText: customerText,
      replyText: reply.text,
      audioBase64: speech.audioBase64,
    };
  }

  private async getBusinessSnapshot(businessId: string) {
    const now = Date.now();
    const cached = this.snapshotCache.get(businessId);
    if (cached && cached.expiresAt > now) {
      return {
        context: cached.context,
        inventory: cached.inventory,
      };
    }

    const [context, inventory] = await Promise.all([
      this.knowledgeBaseService.buildBusinessContext(businessId),
      this.getProductSnapshot(businessId),
    ]);

    this.snapshotCache.set(businessId, {
      expiresAt: now + 30_000,
      context,
      inventory,
    });

    return { context, inventory };
  }

  extractLeadData(transcript: string) {
    return this.openAiProvider.extractLeadData(transcript);
  }

  generateSummary(transcript: string) {
    return this.openAiProvider.generateSummary(transcript);
  }

  transcribeAudio(input: { buffer: Buffer; filename: string; mimeType: string }) {
    return this.openAiProvider.transcribeAudio(input);
  }

  private async getProductSnapshot(businessId: string) {
    const rows = await this.database.db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        status: products.status,
        price: products.price,
        currency: products.currency,
        brand: products.brand,
        model: products.model,
        variant: products.variant,
        locationCity: products.locationCity,
        locationState: products.locationState,
      })
      .from(products)
      .where(eq(products.businessId, Number(businessId)));

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      category: row.category,
      status: row.status,
      price: row.price,
      currency: row.currency,
      brand: row.brand,
      model: row.model,
      variant: row.variant,
      locationCity: row.locationCity,
      locationState: row.locationState,
    }));
  }

  private tryGroundedReply(
    business: CallBusinessContext,
    customerText: string,
    context: Awaited<ReturnType<KnowledgeBaseService["buildBusinessContext"]>>,
    inventory: ProductSnapshot[],
    conversationContext: string,
  ) {
    const text = customerText.toLowerCase();
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const conversation = conversationContext.toLowerCase();
    const settings = business.settings ?? {};
    const serviceType = business.serviceType ?? this.getFirstString(settings, ["serviceType"]) ?? "business";
    const inventoryCount = inventory.length;

    const locationFromBusiness = [business.address, business.city, business.state].filter(Boolean).join(", ");
    const locationFromSettings = this.getFirstString(settings, ["location", "address", "city", "storeAddress"]);

    const locationFromProducts = this.unique(
      inventory
        .map((item) => [item.locationCity, item.locationState].filter(Boolean).join(", "))
        .filter(Boolean),
    );

    const countIntent =
      /(how many|count|number of|total).*(vehicle|vehicles|inventory|products|items|models)/.test(
        normalizedText,
      ) ||
      /(total\s+(items|products|models|inventory))/.test(normalizedText);

    const productInquiryIntent = /(more about|tell me about|details about|know more|about this|about it)/.test(
      normalizedText,
    );
    const availabilityIntent = /(available|availability|in stock|status)/.test(normalizedText);
    const pricingIntent = /(price|cost|on road|on-road|emi|finance)/.test(normalizedText);
    const lowestPriceIntent = /(lowest|cheapest|minimum).*(price|cost|car|vehicle|model)/.test(normalizedText);
    const presentInventoryOnlyIntent = /(at present|currently|now|in your inventory)/.test(normalizedText);

    if (/(\bbye\b|goodbye|thank you|thanks|see you|talk to you later)/.test(normalizedText)) {
      return `Thank you for calling ${business.name}. Have a great day. Goodbye.`;
    }

    const matchedProduct = this.findMatchingProduct(text, inventory);
    const contextualProduct = this.findProductFromConversationContext(conversationContext, inventory);
    const resolvedProduct = matchedProduct ?? contextualProduct;

    if (lowestPriceIntent) {
      const available = inventory.filter((item) => item.status === "available");
      const pool = presentInventoryOnlyIntent ? available : available.length > 0 ? available : inventory;
      if (pool.length === 0) {
        return "I do not have any inventory listed right now.";
      }

      const sorted = [...pool].sort((a, b) => Number(a.price) - Number(b.price));
      const lowest = sorted[0];
      return `${lowest.name} is currently the lowest priced option at about ${this.formatCurrencyForSpeech(
        lowest.price,
        lowest.currency,
      )}. It is ${lowest.status}.`;
    }
    const bookingIntent = /(book|booking|reserve|reservation|hold|block)/.test(normalizedText);
    const bookingPendingInContext =
      /(book|booking|reserve|reservation|hold|block)/.test(conversation) &&
      /(proceed|would you like|available|can book|share your name|contact number|final confirmation)/.test(
        conversation,
      );
    const capturedName = this.extractCustomerName(customerText) ?? this.extractCustomerName(conversationContext);
    const capturedPhone = this.extractValidIndianMobile(customerText) ?? this.extractValidIndianMobile(conversationContext);
    const mentionedPhoneButInvalid = this.hasPhoneLikeNumber(customerText) && !capturedPhone;

    if (bookingPendingInContext && mentionedPhoneButInvalid) {
      return "I got your booking details partially. Please share a valid 10-digit mobile number so I can complete the request.";
    }

    if (bookingPendingInContext && (capturedName || capturedPhone)) {
      if (!capturedName) {
        return "Thanks. Please share your full name for the booking confirmation.";
      }

      if (!capturedPhone) {
        return `Thanks ${capturedName}. Please share your valid 10-digit mobile number for booking confirmation.`;
      }

      const productFromContext = this.findProductFromConversationContext(conversationContext, inventory);
      if (productFromContext) {
        return `Perfect ${capturedName}. Your booking request for ${productFromContext.name} is recorded. We will call you on ${capturedPhone} shortly to complete confirmation.`;
      }

      return `Perfect ${capturedName}. Your booking request is recorded. We will call you on ${capturedPhone} shortly to complete confirmation.`;
    }

    if (bookingIntent && resolvedProduct) {
      if (resolvedProduct.status === "available") {
        return `Yes, ${resolvedProduct.name} is available. I have marked your booking request. Please share your full name and 10-digit mobile number for final confirmation.`;
      }

      return `I checked ${resolvedProduct.name}. It is currently ${resolvedProduct.status}. I can help you with a similar available option.`;
    }

    const affirmativeOnly = /^(yes|yeah|yep|ok|okay|sure|please do|go ahead|confirm|confirmed)\b/.test(
      normalizedText,
    );

    if (affirmativeOnly && bookingPendingInContext) {
      const productFromContext = this.findProductFromConversationContext(conversationContext, inventory);
      if (productFromContext) {
        return `Perfect. Your booking request for ${productFromContext.name} is recorded. Please share your full name and 10-digit mobile number for final confirmation.`;
      }

      return "Perfect. Your booking request is recorded. Please share your full name and 10-digit mobile number for final confirmation.";
    }

    if (resolvedProduct && (productInquiryIntent || availabilityIntent || pricingIntent)) {
      const model = [resolvedProduct.brand, resolvedProduct.model, resolvedProduct.variant]
        .filter(Boolean)
        .join(" ")
        .trim();
      const displayName = model || resolvedProduct.name;

      if (availabilityIntent && !pricingIntent) {
        return `${displayName} is currently ${resolvedProduct.status}.`;
      }

      return `${displayName} is currently ${resolvedProduct.status}. The price is about ${this.formatCurrencyForSpeech(
        resolvedProduct.price,
        resolvedProduct.currency,
      )}. If you want, I can also help you book it now.`;
    }

    if (/(what does|about your company|about your business|organization|who are you)/.test(text)) {
      const desc = business.description?.trim();
      const intro = desc ? `${desc}` : `We're a ${String(serviceType).replaceAll("_", " ")}.`;
      if (inventoryCount > 0) {
        return `Sure. At ${business.name}, ${intro} Right now we have around ${inventoryCount} items in our inventory.`;
      }
      return `Sure. At ${business.name}, ${intro}`;
    }

    if (countIntent) {
      return `At the moment, we have exactly ${inventoryCount} items in inventory.`;
    }

    if (!countIntent && /(list|show|which|what are).*(vehicle|vehicles|inventory|products|items)/.test(text)) {
      if (inventoryCount === 0) {
        return "I do not have any inventory items listed right now. Please check back shortly or contact our team.";
      }

      const top = inventory.slice(0, 8).map((item) => {
        const model = [item.brand, item.model, item.variant].filter(Boolean).join(" ").trim();
        const display = model || item.name;
        return `${display}, priced around ${this.formatCurrencyForSpeech(item.price, item.currency)}`;
      });

      const suffix = inventoryCount > top.length ? ` and ${inventoryCount - top.length} more.` : ".";
      return `Absolutely. Here are some available options: ${top.join(", ")}${suffix}`;
    }

    if (/(location|address|where|city|located)/.test(text)) {
      if (locationFromBusiness) {
        return `We're located at ${locationFromBusiness}.`;
      }
      if (locationFromSettings) {
        return `We're located at ${locationFromSettings}.`;
      }
      if (locationFromProducts.length > 0) {
        return `Our inventory is currently available in ${locationFromProducts.slice(0, 3).join(", ")}.`;
      }

      const faqLocation = context.faqs.find((item) => /(location|address|where|city|located)/i.test(item.question));
      if (faqLocation?.answer) {
        return faqLocation.answer;
      }

      return "I don't have the exact location details right now. If you share your number, our team will send you the full address.";
    }

    if (/(contact|phone number|call us|business number|store number|reach you)/.test(text)) {
      const numbers = [business.businessPhoneNumber, business.virtualPhoneNumber].filter(Boolean);
      if (numbers.length > 0) {
        return `You can reach us at ${numbers[0]}.`;
      }
      return "I don't have a contact number handy right now. Please share your number and our team will call you back.";
    }

    if (resolvedProduct && /(price|cost|available|status|stock|details)/.test(text)) {
      return `${resolvedProduct.name} is currently ${resolvedProduct.status}. The price is about ${this.formatCurrencyForSpeech(
        resolvedProduct.price,
        resolvedProduct.currency,
      )}.`;
    }

    if (/(service|offer|provide|menu|treatment|package)/.test(text) && context.services.length > 0) {
      const serviceNames = context.services.map((service) => service.title).filter(Boolean);
      return `Sure, we offer ${serviceNames.slice(0, 8).join(", ")}. Tell me which one you'd like details on.`;
    }

    return null;
  }

  private findProductFromConversationContext(conversationContext: string, inventory: ProductSnapshot[]) {
    const lower = conversationContext.toLowerCase();
    for (const item of inventory) {
      const candidate = [item.name, item.brand, item.model, item.variant]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .trim();
      if (!candidate) {
        continue;
      }

      const tokens = candidate.split(/\s+/).filter((token) => token.length > 2);
      const score = tokens.reduce((sum, token) => (lower.includes(token) ? sum + 1 : sum), 0);
      if (score >= Math.max(2, Math.floor(tokens.length / 2))) {
        return item;
      }
    }

    return null;
  }

  private hasPhoneLikeNumber(input: string) {
    return /\d[\d\s-]{6,}/.test(input);
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

  private extractCustomerName(input: string) {
    const pattern = /(?:my name is|i am|this is)\s+([a-z][a-z\s.'-]{1,60})/i;
    const match = input.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    const cleaned = match[1]
      .split(/\b(and|my mobile|phone number|mobile number|contact number)\b/i)[0]
      .trim()
      .replace(/\s+/g, " ");
    if (cleaned.length < 2) {
      return null;
    }

    return cleaned
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  private findMatchingProduct(text: string, inventory: ProductSnapshot[]) {
    const input = this.normalizeForMatch(text);
    let best: { item: ProductSnapshot; score: number } | null = null;

    for (const item of inventory) {
      const haystack = this.normalizeForMatch(
        [item.name, item.brand, item.model, item.variant].filter(Boolean).join(" "),
      );
      const tokens = haystack.split(/\s+/).filter((w) => w.length > 2);

      let score = 0;
      for (const token of tokens) {
        if (input.includes(token)) {
          score += 3;
          continue;
        }

        const near = input
          .split(/\s+/)
          .some((word) => word.length > 2 && this.editDistance(word, token) <= 2);
        if (near) {
          score += 2;
        }
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { item, score };
      }
    }

    return best?.score && best.score >= 3 ? best.item : null;
  }

  private normalizeForMatch(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\bkwid\b/g, "quid")
      .replace(/\brenault\b/g, "reynold")
      .replace(/\s+/g, " ")
      .trim();
  }

  private editDistance(a: string, b: string) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= b.length; j += 1) {
      dp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  }

  private buildBusinessProfileText(business: CallBusinessContext) {
    return [
      `name: ${business.name}`,
      `description: ${business.description ?? "not provided"}`,
      `service_type: ${business.serviceType ?? "not provided"}`,
      `contact_number: ${business.businessPhoneNumber ?? "not provided"}`,
      `alternate_number: ${business.virtualPhoneNumber ?? "not provided"}`,
      `primary_email: ${business.primaryEmail ?? "not provided"}`,
      `city: ${business.city ?? "not provided"}`,
      `state: ${business.state ?? "not provided"}`,
      `address: ${business.address ?? "not provided"}`,
    ].join("\n");
  }

  private buildInventoryContext(inventory: ProductSnapshot[]) {
    if (inventory.length === 0) {
      return "No products currently listed.";
    }

    const lines = inventory.slice(0, 20).map((item) => {
      const model = [item.brand, item.model, item.variant].filter(Boolean).join(" ").trim();
      return `${model || item.name} | category=${item.category} | status=${item.status} | price=${this.formatCurrencyForSpeech(item.price, item.currency)}`;
    });

    const extra = inventory.length > 20 ? `\n...and ${inventory.length - 20} more products` : "";
    return `total_inventory=${inventory.length}\n${lines.join("\n")}${extra}`;
  }

  private buildRelevantKnowledgeContext(
    customerText: string,
    context: Awaited<ReturnType<KnowledgeBaseService["buildBusinessContext"]>>,
  ) {
    const terms = this.extractTerms(customerText);

    const rankedFaqs = context.faqs
      .map((faq) => ({
        score: this.relevanceScore(`${faq.question} ${faq.answer}`, terms),
        text: `FAQ\nQ: ${faq.question}\nA: ${faq.answer}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.text);

    const rankedServices = context.services
      .map((service) => ({
        score: this.relevanceScore(`${service.title} ${service.content}`, terms),
        text: `SERVICE\nTitle: ${service.title}\nDetails: ${service.content}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.text);

    return [rankedFaqs.join("\n\n"), rankedServices.join("\n\n")].filter(Boolean).join("\n\n") || "No FAQ/service data.";
  }

  private relevanceScore(text: string, terms: string[]) {
    const haystack = text.toLowerCase();
    return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0);
  }

  private extractTerms(text: string) {
    const stopWords = new Set(["the", "is", "are", "a", "an", "to", "for", "and", "or", "of", "in", "on", "with"]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));
  }

  private getFirstString(settings: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = settings[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private unique(values: string[]) {
    return Array.from(new Set(values));
  }

  private formatCurrencyForSpeech(rawAmount: string, currency: string) {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) {
      return `${currency} ${rawAmount}`;
    }

    if (currency.toUpperCase() !== "INR") {
      return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }

    const rounded = Math.round(amount);
    if (rounded <= 0) {
      return "0 rupees";
    }

    const parts: string[] = [];
    let remaining = rounded;

    const crore = Math.floor(remaining / 10000000);
    if (crore > 0) {
      parts.push(`${crore} crore`);
      remaining %= 10000000;
    }

    const lakh = Math.floor(remaining / 100000);
    if (lakh > 0) {
      parts.push(`${lakh} lakh`);
      remaining %= 100000;
    }

    const thousand = Math.floor(remaining / 1000);
    if (thousand > 0) {
      parts.push(`${thousand} thousand`);
      remaining %= 1000;
    }

    const hundred = Math.floor(remaining / 100);
    if (hundred > 0) {
      parts.push(`${hundred} hundred`);
      remaining %= 100;
    }

    if (remaining > 0) {
      parts.push(`${remaining}`);
    }

    return `${parts.join(" ")} rupees`;
  }
}
