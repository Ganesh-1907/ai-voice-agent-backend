import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, sql } from "drizzle-orm";

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

type FunctionRouteDecision = {
  function: 1 | 2 | 3;
  data?: Record<string, unknown>;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
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
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private async textToSpeech(text: string) {
    const provider = this.config.get<string>("VOICE_PROVIDER") || "elevenlabs";
    if (provider === "browser" || provider === "none") {
      return { audioBase64: null, text };
    }
    const speech = await this.elevenLabsProvider.textToSpeech(text);
    return speech;
  }

  async processCallTurn(business: CallBusinessContext, customerText: string, conversationContext = "") {
    const { context, inventory } = await this.getBusinessSnapshot(business.id);
    const functionRoutedReply = await this.tryFunctionRouterReply(
      business,
      customerText,
      conversationContext,
      inventory,
    );
    if (functionRoutedReply) {
      const speech = await this.textToSpeech(functionRoutedReply);
      return {
        inputText: customerText,
        replyText: functionRoutedReply,
        audioBase64: speech.audioBase64,
      };
    }

    const mustUseSql = this.isSqlMandatoryIntent(customerText);

    const sqlAssistedReply = await this.trySqlDrivenReply(business, customerText, conversationContext);
    if (sqlAssistedReply) {
      const speech = await this.textToSpeech(sqlAssistedReply);
      return {
        inputText: customerText,
        replyText: sqlAssistedReply,
        audioBase64: speech.audioBase64,
      };
    }

    if (mustUseSql) {
      const fallback =
        "I am unable to fetch live pricing details right now. Please try again in a moment, and I will share the exact inventory prices.";
      const speech = await this.textToSpeech(fallback);
      return {
        inputText: customerText,
        replyText: fallback,
        audioBase64: speech.audioBase64,
      };
    }

    const groundedReply = this.tryGroundedReply(
      business,
      customerText,
      context,
      inventory,
      conversationContext,
    );

    if (groundedReply) {
      const speech = await this.textToSpeech(groundedReply);
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
      "For payments, always tell the customer: 'For payment, please visit our store.' Never ask about payment methods or process payments over the phone.",
      "For bookings, you must always collect both the customer's full name and their 10-digit mobile number. If the number is not exactly 10 digits, ask them to provide a valid 10-digit number.",
      "Conversation so far:\n" + (conversationContext || "No prior turns"),
      "Business profile:\n" + this.buildBusinessProfileText(business),
      "Inventory summary:\n" + this.buildInventoryContext(inventory),
      "FAQ/Services context:\n" + this.buildRelevantKnowledgeContext(customerText, context),
    ].join("\n\n");

    const reply = await this.openAiProvider.generateReply(systemPrompt, customerText);
    const speech = await this.textToSpeech(reply.text);

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
      /(how many|count|number of|total).*(vehicle|vehicles|inventory|products|items|models|car|cars)/.test(
        normalizedText,
      ) ||
      /(total\s+(items|products|models|inventory|cars))/.test(normalizedText);

    const productInquiryIntent = /(more about|tell me about|details about|know more|about this|about it)/.test(
      normalizedText,
    );
    const availabilityIntent = /(available|availability|in stock|status)/.test(normalizedText);
    const pricingIntent = /(price|cost|on road|on-road|emi|finance)/.test(normalizedText);
    const rangeIntent = /(between|from).*(and|to|-)|\bbetween\b|\babove\b|\bover\b|\bunder\b|\bbelow\b/.test(
      normalizedText,
    );
    const inventoryListPhrase = /(list|show|sort|give|cars|car|vehicles|vehicle|inventory)/.test(normalizedText);
    const listByPriceIntent =
      /(list|show|sort|give).*(price|cost)/.test(normalizedText) ||
      /(below|under|cheaper|lowest).*(price|cost)/.test(normalizedText) ||
      (pricingIntent && rangeIntent && inventoryListPhrase);
    const lowestPriceIntent = /(lowest|cheapest|minimum).*(price|cost|car|vehicle|model)/.test(normalizedText);
    const presentInventoryOnlyIntent = /(at present|currently|now|in your inventory)/.test(normalizedText);
    const businessNameIntent =
      /(your name|business name|company name|who are you|what is your company)/.test(normalizedText);
    const thanksIntent = /(\bthanks\b|thank you|much appreciated)/.test(normalizedText);
    const carsOnlyIntent = /\b(car|cars)\b/.test(normalizedText);
    const broadPriceInventoryIntent = pricingIntent && (listByPriceIntent || carsOnlyIntent || /inventory|vehicles|products|items/.test(normalizedText));

    if (thanksIntent) {
      return `Thank you for calling ${business.name}. Have a great day.`;
    }

    if (businessNameIntent) {
      return `This is ${business.name}. How can I help you today?`;
    }

    if (/(\bbye\b|goodbye|thank you|thanks|see you|talk to you later)/.test(normalizedText)) {
      return `Thank you for calling ${business.name}. Have a great day. Goodbye.`;
    }

    const matchedProduct = this.findMatchingProduct(text, inventory);
    const contextualProduct = this.findProductFromConversationContext(conversationContext, inventory);
    const resolvedProduct = matchedProduct ?? contextualProduct;
    const explicitModelContext =
      productInquiryIntent ||
      /(this model|that model|about it|about this|its price|that car|this car)/.test(normalizedText);

    if (listByPriceIntent) {
      const available = inventory.filter((item) => item.status === "available");
      const basePool = available.length > 0 ? available : inventory;
      const categoryPool = carsOnlyIntent ? basePool.filter((item) => item.category === "car") : basePool;
      const budgetRange = this.extractBudgetRangeInInr(normalizedText);

      const budgetFiltered = categoryPool.filter((item) => {
        const price = Number(item.price);
        if (!Number.isFinite(price)) {
          return false;
        }

        if (budgetRange.min !== null && price < budgetRange.min) {
          return false;
        }

        if (budgetRange.max !== null && price > budgetRange.max) {
          return false;
        }

        return true;
      });

      const pool = budgetFiltered;

      if (pool.length === 0) {
        if (budgetRange.min !== null || budgetRange.max !== null) {
          return `I could not find ${carsOnlyIntent ? "cars" : "items"} in the requested price range ${this.describeBudgetRangeForSpeech(
            budgetRange,
          )}.`;
        }
        return "I do not have any inventory items listed right now.";
      }

      const topByPrice = this.pickDistinctByModel([...pool])
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 5)
        .map(
          (item) =>
            `${item.name} at about ${this.formatCurrencyForSpeech(item.price, item.currency)} (${item.status})`,
        );

      const scope = carsOnlyIntent ? "cars" : "options";
      const budgetPrefix =
        budgetRange.min !== null || budgetRange.max !== null
          ? `in the range ${this.describeBudgetRangeForSpeech(budgetRange)}`
          : "currently";

      return `Sure. Here are ${scope} ${budgetPrefix}: ${topByPrice.join(", ")}.`;
    }

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

      const productFromContext = this.findBookingProductFromConversation(conversationContext, inventory);
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
      const productFromContext = this.findBookingProductFromConversation(conversationContext, inventory);
      if (productFromContext) {
        return `Perfect. Your booking request for ${productFromContext.name} is recorded. Please share your full name and 10-digit mobile number for final confirmation.`;
      }

      return "Perfect. Your booking request is recorded. Please share your full name and 10-digit mobile number for final confirmation.";
    }

    if (resolvedProduct && (productInquiryIntent || availabilityIntent || (pricingIntent && explicitModelContext))) {
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
      if (carsOnlyIntent) {
        const carCount = inventory.filter((item) => item.category === "car").length;
        return `At the moment, we have exactly ${carCount} cars in inventory.`;
      }

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

    if (resolvedProduct && /(price|cost|available|status|stock|details)/.test(text) && !broadPriceInventoryIntent) {
      return `${resolvedProduct.name} is currently ${resolvedProduct.status}. The price is about ${this.formatCurrencyForSpeech(
        resolvedProduct.price,
        resolvedProduct.currency,
      )}.`;
    }

    if (/(service|offer|provide|menu|treatment|package)/.test(text) && context.services.length > 0) {
      const serviceNames = context.services.map((service) => service.title).filter(Boolean);
      return `Sure, we offer ${serviceNames.slice(0, 8).join(", ")}. Tell me which one you'd like details on.`;
    }

    if (/\b(pay|payment|paying)\b/.test(text)) {
      return "For payment, please visit our store. We do not process payments over the phone.";
    }

    return null;
  }

  private async tryFunctionRouterReply(
    business: CallBusinessContext,
    customerText: string,
    conversationContext: string,
    inventory: ProductSnapshot[],
  ) {
    if (!this.shouldAttemptFunctionRoute(customerText, conversationContext)) {
      return null;
    }

    const recentConversation = this.getLastConversationMessages(conversationContext, 10);
    const route = await this.resolveFunctionRoute(customerText, recentConversation, conversationContext);
    if (!route) {
      return null;
    }

    this.logger.log(`[FUNCTION_FLOW] Selected function=${route.function} data=${JSON.stringify(route.data ?? {})}`);

    if (route.function === 1) {
      return this.handleInventoryFunctionRoute(business, customerText, conversationContext, recentConversation, route);
    }

    if (route.function === 2) {
      return this.handleBusinessDetailsFunctionRoute(business, customerText, recentConversation, route);
    }

    if (route.function === 3) {
      return this.handleBookingFunctionRoute(customerText, conversationContext, inventory, route);
    }

    return null;
  }

  private async resolveFunctionRoute(
    customerText: string,
    recentConversation: string,
    conversationContext: string,
  ): Promise<FunctionRouteDecision | null> {
    const llmRoute = await this.openAiProvider.selectFunctionRoute({
      customerText,
      conversationContext: recentConversation,
    });

    if (llmRoute && [1, 2, 3].includes(llmRoute.function)) {
      return {
        function: llmRoute.function,
        data: llmRoute.data,
      };
    }

    if (this.isBusinessInfoIntent(customerText)) {
      return { function: 2, data: {} };
    }

    if (this.isBookingFlowIntent(customerText, conversationContext)) {
      return { function: 3, data: {} };
    }

    if (this.shouldUseSqlFlow(customerText)) {
      return { function: 1, data: {} };
    }

    return null;
  }

  private async handleInventoryFunctionRoute(
    business: CallBusinessContext,
    customerText: string,
    conversationContext: string,
    recentConversation: string,
    route: FunctionRouteDecision,
  ) {
    const mode = this.getInventoryRouteMode(customerText, route.data);
    const remainingMode = mode === "remaining";
    const forceAllRemaining = remainingMode;

    const enrichedQuery = this.buildInventoryDirectiveQuery(customerText, route.data);
    const forcedLimitFromRoute = this.getPositiveNumberFromRouteData(route.data, [
      "limit",
      "pageSize",
      "maxResults",
    ]);
    const forcedLimit = forceAllRemaining
      ? Math.max(10, Math.min(forcedLimitFromRoute ?? 200, 500))
      : forcedLimitFromRoute ?? undefined;

    const deterministicSql = this.buildDeterministicSqlFallback(business.id, enrichedQuery, conversationContext, {
      forcedLimit,
      forceRemainingAll: forceAllRemaining,
      routeData: route.data,
    });
    this.logger.log(`[FUNCTION_FLOW] Function 1 SQL: ${deterministicSql ?? "<null>"}`);

    if (!deterministicSql || !this.isSafeSelectSql(deterministicSql)) {
      return null;
    }

    let rows: Array<Record<string, unknown>> = [];
    try {
      const result = await this.database.db.execute(sql.raw(deterministicSql));
      const rawRows = Array.isArray(result)
        ? (result as Array<Record<string, unknown>>)
        : (((result as { rows?: Array<Record<string, unknown>> }).rows ?? []) as Array<Record<string, unknown>>);
      rows = rawRows;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SQL execution error";
      this.logger.error(`[FUNCTION_FLOW] Function 1 SQL execution failed: ${message}`);
      return null;
    }

    const templateReply = this.buildInventoryFunctionTemplateReply(enrichedQuery, rows, conversationContext, mode);
    if (!templateReply) {
      return null;
    }

    const useTemplateDirectly =
      mode === "remaining" ||
      mode === "list" ||
      rows.length > 12 ||
      JSON.stringify(rows).length > 3000;

    if (useTemplateDirectly) {
      return templateReply;
    }

    const llmNarration = await this.buildFunctionNarrativeReply(
      business,
      customerText,
      recentConversation,
      route,
      {
        mode,
        sql: deterministicSql,
        rows,
      },
      templateReply,
    );

    return llmNarration ?? templateReply;
  }

  private async handleBusinessDetailsFunctionRoute(
    business: CallBusinessContext,
    customerText: string,
    recentConversation: string,
    route: FunctionRouteDecision,
  ) {
    const details = await this.fetchBusinessDetailsViaSql(business.id);
    if (!details) {
      return null;
    }

    const lowerText = customerText.toLowerCase();
    const requestedTypeRaw = this.getStringFromRouteData(route.data, ["type", "infoType", "intent"]);
    const requestedType = requestedTypeRaw?.toLowerCase();

    const needsName =
      requestedType === "name" || /(business name|company name|your name|who are you)/.test(lowerText) || !requestedType;
    const needsLocation =
      requestedType === "location" || /(location|address|where|city|located)/.test(lowerText) || requestedType === "all";
    const needsContact =
      requestedType === "contact" || /(contact|phone number|call us|reach)/.test(lowerText) || requestedType === "all";

    const businessName = details.businessName?.trim() || business.name;
    const address = details.address?.trim();
    const city = details.city?.trim();
    const state = details.state?.trim();
    const number = details.contactNumber?.trim() || business.businessPhoneNumber;

    const locationParts: string[] = [];
    if (address) {
      locationParts.push(address);
    }
    if (city && !(address && address.toLowerCase().includes(city.toLowerCase()))) {
      locationParts.push(city);
    }
    if (state && !(address && address.toLowerCase().includes(state.toLowerCase()))) {
      locationParts.push(state);
    }

    const replies: string[] = [];
    if (needsName) {
      replies.push(`This is ${businessName}.`);
    }
    if (needsLocation) {
      if (locationParts.length > 0) {
        replies.push(`We're located at ${locationParts.join(", ")}.`);
      } else {
        replies.push("I do not have the exact location details right now.");
      }
    }
    if (needsContact) {
      if (number) {
        replies.push(`You can reach us at ${number}.`);
      } else {
        replies.push("I do not have the contact number right now.");
      }
    }

    const templateReply = replies.join(" ").trim();
    if (!templateReply) {
      return null;
    }

    const llmNarration = await this.buildFunctionNarrativeReply(
      business,
      customerText,
      recentConversation,
      route,
      {
        businessName,
        location: locationParts.join(", "),
        contactNumber: number,
      },
      templateReply,
    );

    return llmNarration ?? templateReply;
  }

  private async handleBookingFunctionRoute(
    customerText: string,
    conversationContext: string,
    inventory: ProductSnapshot[],
    route: FunctionRouteDecision,
  ) {
    const carNameFromData = this.getStringFromRouteData(route.data, ["carName", "productName", "model", "car"]);
    const nameFromData = this.getStringFromRouteData(route.data, ["customerName", "name"]);
    const mobileFromData = this.getStringFromRouteData(route.data, ["customerMobile", "mobile", "phone"]);

    const resolvedProduct =
      (carNameFromData ? this.findMatchingProduct(carNameFromData, inventory) : null) ??
      this.findMatchingProduct(customerText, inventory) ??
      this.findBookingProductFromConversation(conversationContext, inventory);

    const capturedName =
      (nameFromData ? this.extractCustomerName(`my name is ${nameFromData}`) : null) ??
      this.extractCustomerName(customerText) ??
      this.extractCustomerName(conversationContext);

    const capturedPhone =
      (mobileFromData ? this.extractValidIndianMobile(mobileFromData) : null) ??
      this.extractValidIndianMobile(customerText) ??
      this.extractValidIndianMobile(conversationContext);

    if (!resolvedProduct) {
      if (this.isBookingFlowIntent(customerText, conversationContext)) {
        return "Sure, I can help with booking. Please tell me the exact car model name you want to book.";
      }
      return null;
    }

    if (resolvedProduct.status !== "available") {
      return `I checked ${resolvedProduct.name}. It is currently ${resolvedProduct.status}. I can suggest a similar available option.`;
    }

    if (!capturedName) {
      return `Yes, ${resolvedProduct.name} is available. Please share your full name for booking confirmation.`;
    }

    if (!capturedPhone) {
      return `Thanks ${capturedName}. Please share your valid 10-digit mobile number for booking confirmation.`;
    }

    return `Perfect ${capturedName}. Your booking request for ${resolvedProduct.name} is recorded. We will call you on ${capturedPhone} shortly to complete confirmation.`;
  }

  private async buildFunctionNarrativeReply(
    business: CallBusinessContext,
    customerText: string,
    recentConversation: string,
    route: FunctionRouteDecision,
    functionResult: Record<string, unknown>,
    fallbackText: string,
  ) {
    const prompt = [
      `You are a call assistant for ${business.name}.`,
      "Use function result data exactly. Do not add extra models, counts, names, numbers, or addresses.",
      "Keep response concise and phone-friendly.",
      "If function result contains a list, do not exceed listed items.",
      "Conversation history (latest):",
      recentConversation || "No prior turns",
      "Selected function JSON:",
      JSON.stringify(route),
      "Function result data JSON:",
      JSON.stringify(functionResult).slice(0, 5000),
      "If uncertain, repeat fallback text exactly.",
      `Fallback text: ${fallbackText}`,
    ].join("\n\n");

    const response = await this.openAiProvider.generateReply(prompt, customerText);
    const reply = response.text?.trim();
    return reply || fallbackText;
  }

  private buildInventoryFunctionTemplateReply(
    customerText: string,
    rows: Array<Record<string, unknown>>,
    conversationContext: string,
    mode: "count" | "list" | "remaining",
  ) {
    if (mode === "remaining") {
      const items = rows
        .filter((row) => typeof row.name === "string" && typeof row.price !== "undefined")
        .sort((a, b) => Number(a.price) - Number(b.price));

      if (items.length === 0) {
        return "No more matching cars are left in that range.";
      }

      const rendered = items.map((row) => {
        const name = this.sanitizeNameForRequestedFilters(String(row.name), customerText.toLowerCase());
        const price = String(row.price);
        const currency = typeof row.currency === "string" ? row.currency : "INR";
        return `${name} at about ${this.formatCurrencyForSpeech(price, currency)}`;
      });

      const totalToRender = rendered.length;
      const maxRenderable = 60;
      const shown = rendered.slice(0, maxRenderable);
      const hidden = totalToRender - shown.length;

      if (hidden > 0) {
        return `Here are the remaining matching cars: ${shown.join(", ")}. I found ${totalToRender} remaining cars in total; sharing the first ${shown.length} to keep this concise.`;
      }

      return `Here are the remaining matching cars: ${shown.join(", ")}.`;
    }

    if (mode === "count") {
      const count = this.extractCountFromRows(rows);
      if (count !== null) {
        return `There are ${count} matching cars in that range.`;
      }
    }

    return this.buildDeterministicSqlReply(customerText, rows, conversationContext);
  }

  private buildInventoryDirectiveQuery(customerText: string, data?: Record<string, unknown>) {
    if (!data || Object.keys(data).length === 0) {
      return customerText;
    }

    const directives: string[] = [];

    const mode = this.getStringFromRouteData(data, ["mode", "intent"]);
    if (mode) {
      directives.push(`mode ${mode}`);
    }

    const minPriceInr = this.getNumberFromRouteData(data, ["minPriceInr", "minPrice", "priceMin"]);
    const maxPriceInr = this.getNumberFromRouteData(data, ["maxPriceInr", "maxPrice", "priceMax"]);
    if (minPriceInr !== null && maxPriceInr !== null) {
      directives.push(`between ${minPriceInr} and ${maxPriceInr}`);
    } else if (minPriceInr !== null) {
      directives.push(`above ${minPriceInr}`);
    } else if (maxPriceInr !== null) {
      directives.push(`below ${maxPriceInr}`);
    }

    const fuelType = this.getStringFromRouteData(data, ["fuelType", "fuel"]);
    if (fuelType) {
      directives.push(`${fuelType} fuel`);
    }

    const transmission = this.getStringFromRouteData(data, ["transmission", "gearbox"]);
    if (transmission) {
      directives.push(`${transmission} transmission`);
    }

    const location = this.sanitizeRouteLocation(
      this.getStringFromRouteData(data, ["location", "locationCity", "city"]),
    );
    if (location) {
      directives.push(`in ${location}`);
    }

    const suvOnly = this.getBooleanFromRouteData(data, ["suvOnly", "isSuv"]);
    if (suvOnly) {
      directives.push("suv");
    }

    const sortOrder = this.getStringFromRouteData(data, ["sortOrder", "order"]);
    if (sortOrder) {
      directives.push(sortOrder === "desc" ? "descending order" : "ascending order");
    }

    const limit = this.getPositiveNumberFromRouteData(data, ["limit", "pageSize", "maxResults"]);
    if (limit !== null) {
      directives.push(`top ${Math.max(1, Math.min(limit, 200))}`);
    }

    if (directives.length === 0) {
      return customerText;
    }

    return `${customerText}. Derived constraints: ${directives.join(", ")}.`;
  }

  private getInventoryRouteMode(customerText: string, data?: Record<string, unknown>): "count" | "list" | "remaining" {
    const explicitMode = this.getStringFromRouteData(data, ["mode", "intent"]);
    if (explicitMode === "remaining") {
      return "remaining";
    }
    if (explicitMode === "count") {
      return "count";
    }
    if (explicitMode === "list") {
      return "list";
    }

    if (this.isRemainingIntent(customerText)) {
      return "remaining";
    }
    if (this.isCountIntent(customerText)) {
      return "count";
    }

    return "list";
  }

  private shouldAttemptFunctionRoute(customerText: string, conversationContext: string) {
    const text = customerText.toLowerCase().trim();
    if (!text) {
      return false;
    }

    if (/^(thanks|thank you|bye|goodbye|see you)\b/.test(text)) {
      return false;
    }

    return (
      this.shouldUseSqlFlow(customerText) ||
      this.isBusinessInfoIntent(customerText) ||
      this.isBookingFlowIntent(customerText, conversationContext)
    );
  }

  private isBusinessInfoIntent(customerText: string) {
    const text = customerText.toLowerCase();
    return /(business name|company name|your name|who are you|location|address|where are you|contact|phone number|reach you)/.test(
      text,
    );
  }

  private isBookingFlowIntent(customerText: string, conversationContext: string) {
    const text = customerText.toLowerCase();
    const context = conversationContext.toLowerCase();
    return (
      /(book|booking|reserve|reservation|hold|block)/.test(text) ||
      (/(my name is|i am|this is|my number is|phone number|mobile number)/.test(text) &&
        /(book|booking|reserve|reservation|hold|block)/.test(context))
    );
  }

  private getLastConversationMessages(conversationContext: string, maxMessages: number) {
    if (!conversationContext?.trim()) {
      return "";
    }

    return conversationContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-Math.max(1, maxMessages))
      .join("\n");
  }

  private getStringFromRouteData(data: Record<string, unknown> | undefined, keys: string[]) {
    if (!data) {
      return null;
    }

    for (const key of keys) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private getNumberFromRouteData(data: Record<string, unknown> | undefined, keys: string[]) {
    if (!data) {
      return null;
    }

    for (const key of keys) {
      const value = data[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }

      if (typeof value === "string") {
        const parsed = Number(value.replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(parsed)) {
          return Math.trunc(parsed);
        }
      }
    }

    return null;
  }

  private getPositiveNumberFromRouteData(data: Record<string, unknown> | undefined, keys: string[]) {
    const value = this.getNumberFromRouteData(data, keys);
    if (value === null || value <= 0) {
      return null;
    }
    return value;
  }

  private sanitizeRouteLocation(rawLocation: string | null) {
    if (!rawLocation) {
      return null;
    }

    const cleaned = rawLocation
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return null;
    }

    const stopWords = new Set([
      "suv",
      "car",
      "cars",
      "petrol",
      "diesel",
      "electric",
      "cng",
      "automatic",
      "manual",
      "fuel",
      "transmission",
      "below",
      "under",
      "above",
      "over",
      "between",
      "lakhs",
      "lakh",
      "price",
      "range",
      "sorted",
      "ascending",
      "descending",
      "order",
      "india",
      "indian",
      "the",
      "your",
      "my",
      "our",
      "some",
      "total",
      "all",
      "any",
    ]);

    const tokens = cleaned.split(" ").filter((token) => token && !stopWords.has(token));
    if (tokens.length === 0) {
      return null;
    }

    return tokens.slice(0, 3).join(" ");
  }

  private getBooleanFromRouteData(data: Record<string, unknown> | undefined, keys: string[]) {
    if (!data) {
      return false;
    }

    for (const key of keys) {
      const value = data[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.toLowerCase().trim();
        if (["true", "yes", "1"].includes(normalized)) {
          return true;
        }
      }
    }

    return false;
  }

  private async trySqlDrivenReply(
    business: CallBusinessContext,
    customerText: string,
    conversationContext: string,
  ) {
    const fixedReply = await this.tryFixedSqlReply(business, customerText);
    if (fixedReply) {
      return fixedReply;
    }

    const shouldQuerySql = this.shouldUseSqlFlow(customerText);
    if (!shouldQuerySql) {
      return null;
    }

    const listIntent = this.isListIntent(customerText) || this.isImplicitListIntent(customerText);
    const countIntent = this.isCountIntent(customerText);
    const remainingIntent = this.isRemainingIntent(customerText);
    const paginationSensitiveIntent = listIntent || remainingIntent;
    const deterministicSql = this.buildDeterministicSqlFallback(business.id, customerText, conversationContext);
    this.logger.log(`[SQL_FLOW] Deterministic fallback SQL: ${deterministicSql ?? "<null>"}`);

    let normalizedSqlQuery: string | null = null;
    let llmPreferredSql: string | null = null;

    if (paginationSensitiveIntent) {
      this.logger.log("[SQL_FLOW] Skipping LLM SQL generation for pagination-sensitive intent; using deterministic SQL.");
    } else {
      const sqlRequestPayload = {
        businessId: business.id,
        userQuery: this.buildSqlUserQuery(customerText),
        conversationContext,
        schemaPrompt: this.getSqlSchemaPrompt(),
      };
      this.logger.log(`[SQL_FLOW] Request sent for SQL generation: ${JSON.stringify(sqlRequestPayload)}`);

      const sqlQuery = await this.openAiProvider.generateSqlQuery({
        schemaPrompt: sqlRequestPayload.schemaPrompt,
        businessId: sqlRequestPayload.businessId,
        userQuery: sqlRequestPayload.userQuery,
        conversationContext: sqlRequestPayload.conversationContext,
      });
      this.logger.log(`[SQL_FLOW] Raw SQL from LLM: ${sqlQuery ?? "<null>"}`);

      normalizedSqlQuery = this.normalizeGeneratedSql(sqlQuery, business.id);
      this.logger.log(`[SQL_FLOW] Normalized SQL: ${normalizedSqlQuery ?? "<null>"}`);

      const llmSqlLooksCountOnly = normalizedSqlQuery ? this.isCountOnlySql(normalizedSqlQuery) : false;
      const llmSqlSatisfiesFilters = normalizedSqlQuery
        ? this.sqlSatisfiesExplicitFilters(normalizedSqlQuery, customerText)
        : false;

      llmPreferredSql =
        normalizedSqlQuery &&
        this.isSafeSelectSql(normalizedSqlQuery) &&
        this.isBusinessScopedSql(normalizedSqlQuery, business.id) &&
        llmSqlSatisfiesFilters &&
        !(listIntent && llmSqlLooksCountOnly && !countIntent)
          ? normalizedSqlQuery
          : null;

      if (!llmPreferredSql && normalizedSqlQuery) {
        const regenerationUserQuery = [
          this.buildSqlUserQuery(customerText),
          "Regeneration requirements:",
          "- Return one complete valid PostgreSQL SELECT query only.",
          "- Must include business_id = <BUSINESS_ID> in WHERE.",
          listIntent && !countIntent
            ? "- This is a LIST request; do NOT return COUNT(*). Return row-level results."
            : "- This is a COUNT request when applicable.",
        ].join("\n");

        const regeneratedSql = await this.openAiProvider.generateSqlQuery({
          schemaPrompt: sqlRequestPayload.schemaPrompt,
          businessId: sqlRequestPayload.businessId,
          userQuery: regenerationUserQuery,
          conversationContext: sqlRequestPayload.conversationContext,
        });
        this.logger.log(`[SQL_FLOW] Regenerated SQL from LLM: ${regeneratedSql ?? "<null>"}`);

        const normalizedRegeneratedSql = this.normalizeGeneratedSql(regeneratedSql, business.id);
        this.logger.log(`[SQL_FLOW] Normalized regenerated SQL: ${normalizedRegeneratedSql ?? "<null>"}`);

        const regeneratedLooksCountOnly = normalizedRegeneratedSql ? this.isCountOnlySql(normalizedRegeneratedSql) : false;
        const regeneratedSatisfiesFilters = normalizedRegeneratedSql
          ? this.sqlSatisfiesExplicitFilters(normalizedRegeneratedSql, customerText)
          : false;
        llmPreferredSql =
          normalizedRegeneratedSql &&
          this.isSafeSelectSql(normalizedRegeneratedSql) &&
          this.isBusinessScopedSql(normalizedRegeneratedSql, business.id) &&
          regeneratedSatisfiesFilters &&
          !(listIntent && regeneratedLooksCountOnly && !countIntent)
            ? normalizedRegeneratedSql
            : null;
      }
    }

    const executableSql =
      llmPreferredSql
        ? llmPreferredSql
        : deterministicSql && this.isSafeSelectSql(deterministicSql)
          ? deterministicSql
          : null;

    this.logger.log(
      `[SQL_FLOW] Executable SQL source=${
        executableSql === normalizedSqlQuery
          ? "llm-generated"
          : executableSql === llmPreferredSql
            ? "llm-regenerated"
            : executableSql === deterministicSql
              ? "deterministic-fallback"
              : "none"
      } query=${executableSql ?? "<null>"}`,
    );

    if (!executableSql) {
      this.logger.warn("[SQL_FLOW] No safe SQL query available after validation.");
      return null;
    }

    let rows: unknown[] = [];
    try {
      const result = await this.database.db.execute(sql.raw(executableSql));
      rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
      this.logger.log(`[SQL_FLOW] SQL execution returned ${rows.length} row(s): ${JSON.stringify(rows).slice(0, 8000)}`);

      const shouldValidateRows = deterministicSql && executableSql !== deterministicSql;
      if (shouldValidateRows && !this.rowsSatisfyExplicitFilters(rows, customerText)) {
        this.logger.warn("[SQL_FLOW] SQL rows did not satisfy explicit user filters; retrying with deterministic fallback.");
        const retryResult = await this.database.db.execute(sql.raw(deterministicSql));
        rows = Array.isArray(retryResult)
          ? retryResult
          : ((retryResult as { rows?: unknown[] }).rows ?? []);
        this.logger.log(`[SQL_FLOW] Deterministic filter retry returned ${rows.length} row(s): ${JSON.stringify(rows).slice(0, 8000)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SQL execution error";
      this.logger.error(`[SQL_FLOW] SQL execution failed for query: ${executableSql} | error=${message}`);

      const canRetryWithFallback = deterministicSql && executableSql !== deterministicSql && this.isSafeSelectSql(deterministicSql);
      if (!canRetryWithFallback) {
        return null;
      }

      try {
        this.logger.warn(`[SQL_FLOW] Retrying with deterministic fallback SQL: ${deterministicSql}`);
        const retryResult = await this.database.db.execute(sql.raw(deterministicSql));
        rows = Array.isArray(retryResult)
          ? retryResult
          : ((retryResult as { rows?: unknown[] }).rows ?? []);
        this.logger.log(`[SQL_FLOW] Deterministic retry returned ${rows.length} row(s): ${JSON.stringify(rows).slice(0, 8000)}`);
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : "Unknown deterministic SQL execution error";
        this.logger.error(`[SQL_FLOW] Deterministic SQL retry failed: ${retryMessage}`);
        return null;
      }
    }

    const deterministicReply = this.buildDeterministicSqlReply(customerText, rows, conversationContext);
    if (deterministicReply) {
      this.logger.log(`[SQL_FLOW] Deterministic reply from SQL rows: ${deterministicReply}`);
      return deterministicReply;
    }

    const finalPrompt = [
      `You are a call assistant for ${business.name}.`,
      "Use the SQL result set exactly. Do not fabricate values.",
      "If result set is empty, politely say no matching records were found and offer follow-up help.",
      "Keep reply under 2 short sentences unless user asked to list items.",
      "If listing items, keep top 5 and mention they are from current inventory.",
      "Use Indian number reading style for INR when speaking prices.",
      "Conversation history:",
      conversationContext || "No prior turns",
      "SQL result rows (JSON):",
      JSON.stringify(rows).slice(0, 5000),
    ].join("\n\n");

    this.logger.log(
      `[SQL_FLOW] Final LLM reply request context: ${JSON.stringify({
        businessName: business.name,
        customerText,
        conversationContext,
        rowsSample: rows,
        finalPrompt,
      }).slice(0, 12000)}`,
    );

    const response = await this.openAiProvider.generateReply(finalPrompt, customerText);
    const finalReply = response.text?.trim() ? response.text.trim() : null;
    this.logger.log(`[SQL_FLOW] Final LLM reply: ${finalReply ?? "<null>"}`);
    return finalReply;
  }

  private buildDeterministicSqlFallback(
    businessId: string,
    customerText: string,
    conversationContext = "",
    options?: {
      forcedLimit?: number;
      forceRemainingAll?: boolean;
      routeData?: Record<string, unknown>;
    },
  ) {
    const parsedBusinessId = Number(businessId);
    if (!Number.isFinite(parsedBusinessId)) {
      return null;
    }

    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    const listIntent = this.isListIntent(customerText) || this.isImplicitListIntent(customerText);
    const remainingIntent = this.isRemainingIntent(customerText);
    const shouldInheritConstraints = remainingIntent || this.isContextualListFollowupIntent(text);
    const priorConstraints = shouldInheritConstraints
      ? this.extractLatestListConstraintsFromConversation(conversationContext)
      : null;
    const priceIntent =
      /(price|cost|below|under|between|above|over|cheapest|lowest|upto|up to)/.test(text) ||
      /\bfrom\b.*\bto\b/.test(text);
    const countIntent = /(how many|count|number of|total)/.test(text);
    if (!priceIntent && !countIntent && !listIntent && !remainingIntent) {
      return null;
    }

    const carsOnly = /\b(car|cars)\b/.test(text) || !!priorConstraints?.carsOnly;
    const budgetRange = (() => {
      if (options?.routeData) {
        const min = Number(options.routeData.minPriceInr);
        const max = Number(options.routeData.maxPriceInr);
        if (Number.isFinite(min) || Number.isFinite(max)) {
          return { 
            min: Number.isFinite(min) ? min : null, 
            max: Number.isFinite(max) ? max : null 
          };
        }
      }
      
      const fromText = this.extractBudgetRangeInInr(text);
      if (fromText.min !== null || fromText.max !== null) {
        return fromText;
      }

      if (shouldInheritConstraints) {
        return this.extractLatestBudgetRangeFromConversation(conversationContext);
      }

      return fromText;
    })();
    const numericPriceExpr = "NULLIF(regexp_replace(price::text, '[^0-9.]', '', 'g'), '')::numeric";
    const whereClauses = [`business_id = ${parsedBusinessId}`, `${numericPriceExpr} IS NOT NULL`];

    if (carsOnly) {
      whereClauses.push("category = 'car'");
    }

    const fuel = this.extractFuelType(text) ?? (shouldInheritConstraints ? priorConstraints?.fuel ?? null : null);
    if (fuel) {
      whereClauses.push(`fuel_type = '${fuel}'`);
    }

    const transmission =
      this.extractTransmissionType(text) ?? (shouldInheritConstraints ? priorConstraints?.transmission ?? null : null);
    if (transmission) {
      whereClauses.push(`transmission = '${transmission}'`);
    }

    const city = this.extractLocationCity(text) ?? (shouldInheritConstraints ? priorConstraints?.city ?? null : null);
    if (city) {
      whereClauses.push(`lower(location_city) = '${city.toLowerCase()}'`);
    }

    const suvOnly = /\bsuv\b/.test(text) || (shouldInheritConstraints && !!priorConstraints?.suvOnly);
    if (suvOnly) {
      whereClauses.push("(lower(name) like '%suv%' or lower(model) like '%suv%' or lower(search_tags::text) like '%suv%')");
    }

    if (budgetRange.min !== null) {
      whereClauses.push(`${numericPriceExpr} >= ${budgetRange.min}`);
    }
    if (budgetRange.max !== null) {
      whereClauses.push(`${numericPriceExpr} <= ${budgetRange.max}`);
    }

    whereClauses.push("status = 'available'");

    if (countIntent) {
      const countWhere = whereClauses.filter((clause) => !clause.includes("IS NOT NULL"));
      const countSql = [
        "select count(*)::int as total_count",
        "from products",
        `where ${countWhere.join(" and ")}`,
      ].join(" ");
      this.logger.log(`[SQL_FALLBACK] Generated count SQL: ${countSql}`);
      return countSql;
    }

    const standardPageSize = this.extractRequestedLimit(text) ?? 5;
    const requestedLimit = options?.forcedLimit ?? standardPageSize;
    // For lists, fetch a large batch to allow for in-memory distinct filtering
    const pageSize = (listIntent || remainingIntent) ? 500 : Math.max(1, Math.min(requestedLimit, 20));
    const offset = 0; // We handle pagination in-memory for the distinct list

    const sqlQuery = [
      "select id, name, brand, model, variant, category, status, price, currency, fuel_type, transmission, location_city, count(*) over() as total_matches",
      "from products",
      `where ${whereClauses.join(" and ")}`,
      `order by ${numericPriceExpr} asc, id asc`,
      `limit ${pageSize}`,
      offset > 0 ? `offset ${offset}` : "",
    ].join(" ");

    this.logger.log(`[SQL_FALLBACK] Generated SQL: ${sqlQuery}`);
    return sqlQuery;
  }

  private async tryFixedSqlReply(business: CallBusinessContext, customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();

    if (/(\bthanks\b|thank you|much appreciated)/.test(text)) {
      return `Thank you for calling ${business.name}. Have a great day.`;
    }

    if (/(\bbye\b|goodbye|see you|talk to you later)/.test(text)) {
      return `Thank you for calling ${business.name}. Have a great day. Goodbye.`;
    }

    const companyIntent = /(your name|business name|company name|who are you|what is your company)/.test(text);
    const locationIntent = /(location|address|where|city|located)/.test(text);
    const contactIntent = /(contact|phone number|call us|business number|store number|reach you)/.test(text);

    if (!companyIntent && !locationIntent && !contactIntent) {
      return null;
    }

    const details = await this.fetchBusinessDetailsViaSql(business.id);

    if (companyIntent) {
      const businessName = details?.businessName?.trim() || business.name;
      return `This is ${businessName}. How can I help you today?`;
    }

    if (contactIntent) {
      const number = details?.contactNumber?.trim() || business.businessPhoneNumber;
      if (number) {
        return `You can reach us at ${number}.`;
      }
      return "I do not have the contact number right now. Please share your number and our team will call you back.";
    }

    if (locationIntent) {
      const address = details?.address?.trim();
      const city = details?.city?.trim();
      const state = details?.state?.trim();
      const locationParts: string[] = [];

      if (address) {
        locationParts.push(address);
      }
      if (city && !(address && address.toLowerCase().includes(city.toLowerCase()))) {
        locationParts.push(city);
      }
      if (state && !(address && address.toLowerCase().includes(state.toLowerCase()))) {
        locationParts.push(state);
      }

      const location = locationParts.join(", ").trim();
      if (location) {
        return `We're located at ${location}.`;
      }
      return "I do not have the exact location details right now. Please share your number and our team will send you the address.";
    }

    return null;
  }

  private async fetchBusinessDetailsViaSql(businessId: string) {
    const parsedId = Number(businessId);
    if (!Number.isFinite(parsedId)) {
      return null;
    }

    try {
      const result = await this.database.db.execute(sql`
        select business_name, contact_number, city, state, address
        from businesses
        where id = ${parsedId}
        limit 1
      `);

      const rows = Array.isArray(result)
        ? (result as Array<Record<string, unknown>>)
        : (((result as { rows?: Array<Record<string, unknown>> }).rows ?? []) as Array<Record<string, unknown>>);

      const first = rows[0];
      if (!first) {
        return null;
      }

      return {
        businessName: typeof first.business_name === "string" ? first.business_name : undefined,
        contactNumber: typeof first.contact_number === "string" ? first.contact_number : undefined,
        city: typeof first.city === "string" ? first.city : undefined,
        state: typeof first.state === "string" ? first.state : undefined,
        address: typeof first.address === "string" ? first.address : undefined,
      };
    } catch {
      return null;
    }
  }

  private isSqlMandatoryIntent(customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    return /(price|cost|below|under|between|above|over|cheapest|lowest|upto|up to)/.test(text) || /\bfrom\b.*\bto\b/.test(text);
  }

  private shouldUseSqlFlow(customerText: string) {
    const text = customerText.toLowerCase();
    if (/(\bthanks\b|thank you|bye|goodbye|see you)/.test(text)) {
      return false;
    }

    return /(how many|count|number of|inventory|list|show|price|cost|lowest|cheapest|below|under|between|above|over|available|location|address|city|contact|phone|upto|up to|remaining|petrol|diesel|automatic|manual|suv)/.test(
      text,
    ) || /\bfrom\b.*\bto\b/.test(text);
  }

  private getSqlSchemaPrompt() {
    return [
      "Table: businesses(id, business_name, slug, service_type, contact_number, primary_email, primary_mobile, city, state, address, voice_agent_enabled, metadata, created_at, updated_at)",
      "Table: users(id, business_id, email, password_hash, mobile, name, role, is_active, last_login_at, created_at, updated_at)",
      "Table: products(id, business_id, name, slug, description, category, condition, status, sku, brand, model, variant, price, discount_price, currency, stock_quantity, manufacture_year, registration_year, purchase_year, mileage_km, fuel_type, transmission, color, location_city, location_state, condition_notes, search_tags, specifications, is_featured, sold_at, created_at, updated_at)",
      "Table: product_images(id, product_id, image_url, alt_text, is_primary, sort_order, created_at, updated_at)",
      "Table: calls(id, business_id, exotel_call_sid, from_number, to_number, original_business_number, status, started_at, ended_at, duration_seconds, transcript, summary, meta, created_at, updated_at)",
      "Table: call_turns(id, call_id, speaker, text, created_at)",
      "Table: call_requests(id, call_id, business_id, from_number, customer_name, customer_mobile, summary, request_type, status, approval_note, approved_at, messaged_to_customer, messaged_at, called_back, called_back_at, created_at, updated_at)",
      "Important: products.status valid values are draft, available, reserved, sold, inactive. Never use status='active'.",
      "Important: for numeric compare/sort use NULLIF(regexp_replace(price::text, '[^0-9.]', '', 'g'), '')::numeric.",
      "Important: when user says values like 10 lakh, 10 lakhs, or 10 lakh 50 thousand, treat them as rupee integers (1000000, 1050000).",
    ].join("\n");
  }

  private isSafeSelectSql(query: string) {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!/^select\s/i.test(normalized)) {
      return false;
    }

    const semicolonCount = (normalized.match(/;/g) ?? []).length;
    if (semicolonCount > 0 && !/;\s*$/.test(normalized)) {
      return false;
    }

    if (/(insert|update|delete|drop|alter|truncate|grant|revoke|create)\s/i.test(normalized)) {
      return false;
    }

    if (!/( from businesses| from users| from products| from product_images| from calls| from call_turns| from call_requests)/i.test(normalized)) {
      return false;
    }

    return true;
  }

  private normalizeGeneratedSql(query: string | null, businessId: string) {
    if (!query) {
      return null;
    }

    return query
      .trim()
      .replace(/<BUSINESS_ID>/gi, businessId)
      .replace(/:business_id/gi, businessId)
      .replace(/\bbusiness_id\s*=\s*\d+/gi, `business_id = ${businessId}`)
      .replace(/\bbusiness_id\s*=\s*'\d+'/gi, `business_id = ${businessId}`)
      .replace(/status\s*=\s*'active'/gi, "status = 'available'")
      .replace(/regexp_replace\(([^,]+),\s*'\[\^0-9\.\]'\s*,\s*''\s*,\s*'g'\)/gi, "regexp_replace(($1)::text, '[^0-9.]', '', 'g')")
      .replace(/regexp_replace\(([^,]+),\s*'\[\^0-9\]'\s*,\s*''\s*,\s*'g'\)/gi, "regexp_replace(($1)::text, '[^0-9.]', '', 'g')")
      .replace(/;\s*$/, "");
  }

  private isBusinessScopedSql(query: string, businessId: string) {
    const normalized = query.toLowerCase().replace(/\s+/g, " ");
    const scopedTablePattern = /\bfrom\s+(products|calls|call_requests|users)\b|\bjoin\s+(products|calls|call_requests|users)\b/i;
    if (!scopedTablePattern.test(normalized)) {
      return true;
    }

    const id = businessId.replace(/[^0-9]/g, "");
    if (!id) {
      return false;
    }

    return new RegExp(`\\bbusiness_id\\s*=\\s*${id}\\b`, "i").test(normalized);
  }

  private isListIntent(customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    return /(list|show|give|display|load|which cars|what are the cars|tell me the cars|which models|available models|models are available|list out)/.test(text);
  }

  private isImplicitListIntent(customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    const vehiclesMentioned = /\b(car|cars|vehicle|vehicles|model|models|inventory)\b/.test(text);
    const explicitConstraints = this.hasExplicitQueryConstraints(text) || /\bonly\b/.test(text);
    const countIntent = this.isCountIntent(text);
    const remainingIntent = this.isRemainingIntent(text);
    return vehiclesMentioned && explicitConstraints && !countIntent && !remainingIntent;
  }

  private isContextualListFollowupIntent(normalizedText: string) {
    return /(those|these|them|same|in that range|in this range|remaining|more|next|ascending|descending|sort|order)/.test(
      normalizedText,
    );
  }

  private isRemainingIntent(customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    return /(remaining|more cars|list remaining|show remaining|next cars|other cars in this range)/.test(text);
  }

  private isCountIntent(customerText: string) {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    return /(how many|count|number of|total)/.test(text);
  }

  private isCountOnlySql(query: string) {
    const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
    return /^select\s+count\s*\(/.test(normalized);
  }

  private sqlSatisfiesExplicitFilters(query: string, customerText: string) {
    const sqlText = query.toLowerCase().replace(/\s+/g, " ");
    const userText = customerText.toLowerCase().replace(/\s+/g, " ");
    const productQuery = /\bfrom\s+products\b/.test(sqlText);

    if (productQuery && !/status\s*=\s*'available'/.test(sqlText)) {
      return false;
    }

    if (/\b(car|cars)\b/.test(userText) && productQuery && !/category\s*=\s*'car'/.test(sqlText)) {
      return false;
    }

    if (/\bpetrol\b/.test(userText) && !/fuel_type\s*=\s*'petrol'/.test(sqlText)) {
      return false;
    }
    if (/\bdiesel\b/.test(userText) && !/fuel_type\s*=\s*'diesel'/.test(sqlText)) {
      return false;
    }
    if (/\bautomatic\b/.test(userText) && !/transmission\s*=\s*'automatic'/.test(sqlText)) {
      return false;
    }
    if (/\bmanual\b/.test(userText) && !/transmission\s*=\s*'manual'/.test(sqlText)) {
      return false;
    }

    const city = this.extractLocationCity(userText);
    if (city && !new RegExp(`location_city[^']*'${city.toLowerCase()}'`, "i").test(sqlText)) {
      return false;
    }

    const range = this.extractBudgetRangeInInr(userText);
    if (range.min !== null && !new RegExp(`(?:>=|>)\\s*${range.min}\\b`).test(sqlText)) {
      return false;
    }
    if (range.max !== null && !new RegExp(`(?:<=|<)\\s*${range.max}\\b`).test(sqlText)) {
      return false;
    }

    return true;
  }

  private hasExplicitQueryConstraints(text: string) {
    const budget = this.extractBudgetRangeInInr(text);
    const fuel = this.extractFuelType(text);
    const trans = this.extractTransmissionType(text);
    const city = this.extractLocationCity(text);
    const suv = /\bsuv\b/.test(text);

    if (budget.min !== null || budget.max !== null || fuel || trans || city || suv) {
      this.logger.log(`[CONSTRAINTS] Found: budget=${JSON.stringify(budget)}, fuel=${fuel}, trans=${trans}, city=${city}, suv=${suv}`);
      return true;
    }
    return false;
  }

  private rowsSatisfyExplicitFilters(rows: unknown[], customerText: string) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return true;
    }

    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    const expectedFuel = this.extractFuelType(text);
    const expectedTransmission = this.extractTransmissionType(text);
    const expectedCity = this.extractLocationCity(text)?.toLowerCase();

    if (!expectedFuel && !expectedTransmission && !expectedCity) {
      return true;
    }

    return rows.every((row) => {
      const r = row as Record<string, unknown>;
      const fuel = typeof r.fuel_type === "string" ? r.fuel_type.toLowerCase() : "";
      const transmission = typeof r.transmission === "string" ? r.transmission.toLowerCase() : "";
      const city = typeof r.location_city === "string" ? r.location_city.toLowerCase() : "";

      if (expectedFuel && !fuel) {
        return false;
      }
      if (expectedFuel && fuel !== expectedFuel) {
        return false;
      }
      if (expectedTransmission && !transmission) {
        return false;
      }
      if (expectedTransmission && transmission !== expectedTransmission) {
        return false;
      }
      if (expectedCity && !city) {
        return false;
      }
      if (expectedCity && city !== expectedCity) {
        return false;
      }

      return true;
    });
  }

  private filterRowsForDisplay(rows: Array<Record<string, unknown>>, userText: string) {
    const expectedFuel = this.extractFuelType(userText);
    const expectedTransmission = this.extractTransmissionType(userText);
    const expectedCity = this.extractLocationCity(userText)?.toLowerCase();

    if (!expectedFuel && !expectedTransmission && !expectedCity) {
      return rows;
    }

    return rows.filter((row) => {
      const fuel = typeof row.fuel_type === "string" ? row.fuel_type.toLowerCase() : "";
      const transmission = typeof row.transmission === "string" ? row.transmission.toLowerCase() : "";
      const city = typeof row.location_city === "string" ? row.location_city.toLowerCase() : "";

      if (expectedFuel && fuel && fuel !== expectedFuel) {
        return false;
      }
      if (expectedCity && city && city !== expectedCity) {
        return false;
      }

      if (expectedTransmission === "automatic") {
        if (transmission && transmission !== "automatic") {
          return false;
        }
      }

      if (expectedTransmission === "manual") {
        if (transmission && transmission !== "manual") {
          return false;
        }
      }

      return true;
    });
  }

  private sanitizeNameForRequestedFilters(name: string, userText: string) {
    const expectedFuel = this.extractFuelType(userText);
    const expectedTransmission = this.extractTransmissionType(userText);

    let sanitized = name;

    if (expectedFuel === "diesel") {
      sanitized = sanitized.replace(/\bpetrol\b/gi, "").replace(/\s{2,}/g, " ").trim();
    }
    if (expectedFuel === "petrol") {
      sanitized = sanitized.replace(/\bdiesel\b/gi, "").replace(/\s{2,}/g, " ").trim();
    }

    if (expectedTransmission === "automatic") {
      sanitized = sanitized
        .replace(/\bmanual\b/gi, "")
        .replace(/\bMT\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    if (expectedTransmission === "manual") {
      sanitized = sanitized
        .replace(/\bautomatic\b/gi, "")
        .replace(/\bAT\b/g, "")
        .replace(/\bAMT\b/g, "")
        .replace(/\bCVT\b/g, "")
        .replace(/\bDCT\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    return sanitized || name;
  }

  private buildDeterministicSqlReply(customerText: string, rows: unknown[], conversationContext = "") {
    const text = customerText.toLowerCase().replace(/\s+/g, " ").trim();
    const countIntent = /(how many|count|number of|total)/.test(text);
    const listIntent = this.isListIntent(customerText) || this.isImplicitListIntent(customerText);
    const remainingIntent = this.isRemainingIntent(customerText);

    this.logger.log(`[SQL_REPLY] text="${text}" countIntent=${countIntent} listIntent=${listIntent} rows=${(rows as any[]).length}`);

    if (countIntent) {
      const count = this.extractCountFromRows(rows);
      if (count !== null) {
        const carsOnly = /\b(car|cars)\b/.test(text);
        const hasConstraints = this.hasExplicitQueryConstraints(text);
        if (hasConstraints) {
          return carsOnly ? `There are ${count} cars in that range.` : `There are ${count} matching items in that range.`;
        }
        return carsOnly ? `There are ${count} cars in inventory.` : `There are ${count} items in inventory.`;
      }
    }

    if (listIntent || remainingIntent) {
      const baseItems = this.pickDistinctRowsByModel(
        rows
          .map((row) => row as Record<string, unknown>)
          .filter((row) => typeof row.name === "string" && typeof row.price !== "undefined")
          .sort((a, b) => Number(a.price) - Number(b.price)),
      );

      const allItems = this.filterRowsForDisplay(baseItems, text);
      if (allItems.length === 0) {
        return "No matching records were found. If you want, I can suggest nearby price options.";
      }

      const pageSize = 5;
      const priorRemainingRequests = this.countPriorRemainingRequests(conversationContext, customerText);
      const alreadyShownCount = remainingIntent ? (priorRemainingRequests + 1) * pageSize : 0;
      
      const selected = allItems.slice(alreadyShownCount, alreadyShownCount + pageSize);
      if (selected.length === 0) {
        return remainingIntent 
          ? "I have already shown you all the matching cars in this range."
          : "No matching records were found.";
      }

      const totalMatches = allItems.length;

      const top = selected.map((row) => {
        const name = this.sanitizeNameForRequestedFilters(String(row.name), text);
        const price = String(row.price);
        const currency = typeof row.currency === "string" ? row.currency : "INR";
        return `${name} at about ${this.formatCurrencyForSpeech(price, currency)}`;
      });

      const totalPhysicalMatches = rows.length;
      const remainingCount = Math.max(0, totalMatches - alreadyShownCount - selected.length);
      const remainingPhysicalCount = Math.max(0, totalPhysicalMatches - alreadyShownCount - selected.length);
      
      const prefix = remainingIntent ? "Here are more matching cars" : "Here are the matching cars";
      if (remainingCount > 0 || remainingPhysicalCount > 0) {
        let moreText = "";
        if (remainingCount > 0) {
          moreText = `There are ${remainingCount} more models and about ${remainingPhysicalCount} more cars in total.`;
        } else {
          moreText = `There are about ${remainingPhysicalCount} more variants of these models available.`;
        }
        return `${prefix}: ${top.join(", ")}. ${moreText} Would you like me to list the remaining cars as well?`;
      }

      return `${prefix}: ${top.join(", ")}.`;
    }

    return null;
  }

  private extractCountFromRows(rows: unknown[]) {
    const first = rows[0] as Record<string, unknown> | undefined;
    if (!first) {
      return null;
    }

    const candidateKeys = ["total_count", "count", "count(*)"];
    for (const key of candidateKeys) {
      const value = first[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === "string" && /^\d+$/.test(value)) {
        return Number(value);
      }
    }

    return null;
  }

  private extractRequestedLimit(text: string) {
    const match = text.match(/\b(?:top|first|cheapest|lowest)\s+(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})\s+(?:cars|items|models)\b/i);
    if (!match?.[1]) {
      return null;
    }

    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.min(parsed, 20);
  }

  private extractFuelType(text: string) {
    if (/\bpetrol\b/.test(text)) {
      return "petrol";
    }
    if (/\bdiesel\b/.test(text)) {
      return "diesel";
    }
    if (/\belectric\b/.test(text)) {
      return "electric";
    }
    if (/\bcng\b/.test(text)) {
      return "cng";
    }
    return null;
  }

  private extractTransmissionType(text: string) {
    if (/\bautomatic\b/.test(text)) {
      return "automatic";
    }
    if (/\bmanual\b/.test(text)) {
      return "manual";
    }
    return null;
  }

  private extractLocationCity(text: string) {
    const normalizedInput = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cityMatch = normalizedInput.match(
      /\b(?:in|at)\s+([a-z][a-z\s]{1,30}?)(?=\s+(?:below|under|above|over|between|from|to|with|and|price|cost|cars?|lakhs?|rupees|inr|sorted?|order|ascending|descending|remaining|more|next|only|status|available|inventory|stock|suv|petrol|diesel|automatic|manual|fuel|transmission)\b|$)/i,
    );
    if (!cityMatch?.[1]) {
      return null;
    }

    const normalized = cityMatch[1].trim().replace(/\s+/g, " ");
    this.logger.log(`[CITY_EXTRACT] Raw match: "${cityMatch[1]}" Normalized: "${normalized}"`);
    if (/(inventory|price|range|cars|car|lakhs|lakh|rupees|ascending|descending|order|sorted|remaining|next|same|that|this|the|your|my|our|some|stock|suv|petrol|diesel|automatic|manual|fuel|transmission|india|indian|total|all|any)/i.test(normalized)) {
      return null;
    }

    return normalized;
  }

  private extractLatestBudgetRangeFromConversation(conversationContext: string) {
    const lines = conversationContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!/(price|cost|below|under|between|above|over|lakh|lakhs|range|from|to)/.test(lower)) {
        continue;
      }

      const range = this.extractBudgetRangeInInr(lower);
      if (range.min !== null || range.max !== null) {
        return range;
      }
    }

    return { min: null as number | null, max: null as number | null };
  }

  private extractLatestListConstraintsFromConversation(conversationContext: string) {
    if (!conversationContext?.trim()) {
      return null;
    }

    const lines = conversationContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      if (!/^customer:/i.test(line)) {
        continue;
      }

      const utterance = line.replace(/^customer:\s*/i, "").trim().toLowerCase();
      if (!utterance || this.isRemainingIntent(utterance)) {
        continue;
      }

      const range = this.extractBudgetRangeInInr(utterance);
      const fuel = this.extractFuelType(utterance);
      const transmission = this.extractTransmissionType(utterance);
      const city = this.extractLocationCity(utterance);
      const carsOnly = /\b(car|cars|models)\b/.test(utterance);
      const suvOnly = /\bsuv\b/.test(utterance);
      const hasExplicitConstraint = range.min !== null || range.max !== null || !!fuel || !!transmission || !!city || suvOnly;
      const contextualListFollowup = this.isContextualListFollowupIntent(utterance);

      const hasRelevantConstraint =
        hasExplicitConstraint ||
        carsOnly ||
        /(below|under|between|above|over|price|cost|available|which models|list|show)/.test(utterance);

      if (!hasRelevantConstraint) {
        continue;
      }

      if (contextualListFollowup && !hasExplicitConstraint) {
        continue;
      }

      return {
        min: range.min,
        max: range.max,
        fuel,
        transmission,
        city,
        carsOnly,
        suvOnly,
      };
    }

    return null;
  }

  private countPriorRemainingRequests(conversationContext: string, currentCustomerText = "") {
    if (!conversationContext?.trim()) {
      return 0;
    }

    const customerTurns = conversationContext
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.startsWith("customer:"))
      .map((line) => line.replace(/^customer:\s*/, "").trim());

    if (customerTurns.length === 0) {
      return 0;
    }

    const normalizedCurrent = currentCustomerText.toLowerCase().replace(/\s+/g, " ").trim();
    const turnsExcludingCurrent = [...customerTurns];
    if (
      this.isRemainingIntent(normalizedCurrent) &&
      turnsExcludingCurrent.length > 0 &&
      this.isRemainingIntent(turnsExcludingCurrent[turnsExcludingCurrent.length - 1])
    ) {
      turnsExcludingCurrent.pop();
    }

    let anchorIndex = -1;
    for (let i = turnsExcludingCurrent.length - 1; i >= 0; i -= 1) {
      const turn = turnsExcludingCurrent[i];
      const isListingAnchor =
        !this.isRemainingIntent(turn) &&
        ((this.isListIntent(turn) || this.isImplicitListIntent(turn)) ||
          this.isSqlMandatoryIntent(turn) ||
          /(available|which models|cars|car|models|below|under|between|above|over|range|price|cost)/.test(turn));
      if (isListingAnchor) {
        anchorIndex = i;
        break;
      }
    }

    const scopeStart = anchorIndex >= 0 ? anchorIndex + 1 : 0;
    const totalRemainingMentions = turnsExcludingCurrent
      .slice(scopeStart)
      .filter((turn) => this.isRemainingIntent(turn)).length;

    return totalRemainingMentions;
  }

  private pickDistinctRowsByModel(rows: Array<Record<string, unknown>>) {
    const seen = new Set<string>();
    const result: Array<Record<string, unknown>> = [];

    // First pass: Pick one of each model
    for (const row of rows) {
      const brand = typeof row.brand === "string" ? row.brand : "";
      const model = typeof row.model === "string" ? row.model : "";
      const signature = [brand, model].join("|").toLowerCase().trim();

      if (!signature || seen.has(signature)) continue;
      seen.add(signature);
      result.push(row);
      if (result.length >= 10) break; 
    }

    // Second pass: If we have fewer than 5 items, add variants (different years/names)
    if (result.length < 5) {
      const seenFull = new Set(result.map(r => String(r.name).toLowerCase().trim()));
      for (const row of rows) {
        const name = String(row.name).toLowerCase().trim();
        if (seenFull.has(name)) continue;
        seenFull.add(name);
        result.push(row);
        if (result.length >= 10) break;
      }
    }

    return result;
  }

  private buildSqlUserQuery(customerText: string) {
    const normalized = this.normalizeIndianAmountText(customerText);
    const moneyHints = this.extractMoneyNormalizationHints(normalized);
    if (moneyHints.length === 0) {
      return customerText;
    }

    return [customerText, "Normalized INR values:", ...moneyHints.map((hint) => `- ${hint}`)].join("\n");
  }

  private extractMoneyNormalizationHints(normalizedText: string) {
    const hints: string[] = [];
    const budgetRange = this.extractBudgetRangeInInr(normalizedText);
    if (budgetRange.min !== null && budgetRange.max !== null) {
      hints.push(`between ${budgetRange.min} and ${budgetRange.max}`);
    } else if (budgetRange.min !== null) {
      hints.push(`minimum ${budgetRange.min}`);
    } else if (budgetRange.max !== null) {
      hints.push(`maximum ${budgetRange.max}`);
    }

    const phraseRegex =
      /(\d[\d,]*(?:\.\d+)?(?:\s*(?:crore|crores|lakh|lakhs|thousand|k)\b(?:\s*\d[\d,]*(?:\.\d+)?\s*(?:crore|crores|lakh|lakhs|thousand|k)\b){0,2})?)/gi;
    const matches = normalizedText.match(phraseRegex) ?? [];
    const seen = new Set<string>();

    for (const phrase of matches) {
      const amount = this.parseCompositeIndianAmount(phrase);
      if (amount === null) {
        continue;
      }

      const key = `${phrase.trim()}=${amount}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      hints.push(`${phrase.trim()} = ${amount}`);
    }

    return hints;
  }

  private parseCompositeIndianAmount(phrase: string) {
    const tokenRegex = /(\d[\d,]*(?:\.\d+)?)\s*(crore|crores|lakh|lakhs|thousand|k)?/gi;
    let match: RegExpExecArray | null;
    let total = 0;
    let sawAny = false;

    while (true) {
      match = tokenRegex.exec(phrase);
      if (!match) {
        break;
      }

      const raw = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(raw)) {
        continue;
      }

      const unit = (match[2] ?? "").toLowerCase();
      let multiplier = 1;
      if (unit.startsWith("crore")) {
        multiplier = 10000000;
      } else if (unit.startsWith("lakh")) {
        multiplier = 100000;
      } else if (unit === "thousand" || unit === "k") {
        multiplier = 1000;
      }

      total += raw * multiplier;
      sawAny = true;
    }

    if (!sawAny) {
      return null;
    }

    return Math.round(total);
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

  private findBookingProductFromConversation(conversationContext: string, inventory: ProductSnapshot[]) {
    const lines = conversationContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      const lower = line.toLowerCase();
      let candidatePhrase: string | null = null;

      const bookingRecorded = lower.match(/booking request for\s+(.+?)\s+is recorded/i);
      if (bookingRecorded?.[1]) {
        candidatePhrase = bookingRecorded[1];
      }

      if (!candidatePhrase) {
        const availablePrompt = lower.match(/yes,\s+(.+?)\s+is available/i);
        if (availablePrompt?.[1]) {
          candidatePhrase = availablePrompt[1];
        }
      }

      if (!candidatePhrase) {
        const customerBooking = lower.match(/(?:book|booking|reserve|reservation|hold)\s+(?:a|an|the)?\s*(.+)$/i);
        if (customerBooking?.[1]) {
          candidatePhrase = customerBooking[1];
        }
      }

      if (!candidatePhrase) {
        continue;
      }

      const matched = this.findMatchingProduct(candidatePhrase, inventory);
      if (matched) {
        return matched;
      }
    }

    return this.findProductFromConversationContext(conversationContext, inventory);
  }

  private hasPhoneLikeNumber(input: string) {
    return /\d[\d\s-]{6,}/.test(input);
  }

  private extractValidIndianMobile(input: string) {
    const normalized = this.normalizeSpokenDigits(input);
    const matches = normalized.match(/[\d\s-()+]{8,}/g) ?? [];
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

  private normalizeSpokenDigits(text: string) {
    let normalized = text.toLowerCase();
    const map: Record<string, string> = {
      zero: "0",
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
    };

    // Handle "double X" and "triple X"
    normalized = normalized.replace(/\bdouble\s+(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (m, p1) => map[p1] + map[p1]);
    normalized = normalized.replace(/\btriple\s+(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (m, p1) => map[p1] + map[p1] + map[p1]);

    // Replace single words
    Object.keys(map).forEach((word) => {
      normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), map[word]);
    });

    return normalized;
  }

  private extractCustomerName(input: string) {
    const normalizedInput = input.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
    
    // Pattern 1: Explicit introduction
    const explicitPattern = /(?:my name is|i am|this is)\s+([a-z][a-z\s'-]{1,60})/i;
    const explicitMatch = normalizedInput.match(explicitPattern);
    if (explicitMatch?.[1]) {
      return this.cleanAndCapitalizeName(explicitMatch[1]);
    }

    // Pattern 2: Customer reply in conversation context after an agent prompt for name
    const contextualPattern = /(?:share your full name|what is your name|your name please)[\s\S]*?customer:\s*([a-z][a-z\s'-]{1,40})(?:\b|$)/i;
    const contextualMatch = input.match(contextualPattern);
    if (contextualMatch?.[1]) {
      return this.cleanAndCapitalizeName(contextualMatch[1]);
    }

    // Pattern 3: Standalone name (risky but useful for direct replies)
    // Only use this if the input is short and looks like a name
    if (normalizedInput.split(" ").length <= 4 && /^[a-z\s'-]+$/i.test(normalizedInput)) {
      // Avoid common filler words
      if (!/^(yes|no|ok|sure|thanks?|hello|hi|hey|please|booking|cars?)$/i.test(normalizedInput)) {
        return this.cleanAndCapitalizeName(normalizedInput);
      }
    }

    return null;
  }

  private cleanAndCapitalizeName(raw: string) {
    const cleaned = raw
      .replace(/\b(agent|customer)\b[\s\S]*$/i, "")
      .split(/\b(and|my mobile|phone number|mobile number|contact number)\b/i)[0]
      .trim()
      .replace(/[.!,;:]+$/g, "")
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

  private extractBudgetRangeInInr(normalizedText: string) {
    const moneyText = this.normalizeIndianAmountText(normalizedText);
    const empty = { min: null as number | null, max: null as number | null };

    const aboveBelowPattern =
      /(?:above|over|more than|greater than|starting from)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)\s*(?:and|,)?\s*(?:below|under|less than|upto|up to|within)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const aboveBelow = moneyText.match(aboveBelowPattern);
    if (aboveBelow) {
      const min = this.parseCompositeIndianAmount(aboveBelow[1]);
      const max = this.parseCompositeIndianAmount(aboveBelow[2]);
      if (min !== null && max !== null) {
        return {
          min: Math.min(min, max),
          max: Math.max(min, max),
        };
      }
    }

    const belowAbovePattern =
      /(?:below|under|less than|upto|up to|within)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)\s*(?:and|,)?\s*(?:above|over|more than|greater than|starting from)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const belowAbove = moneyText.match(belowAbovePattern);
    if (belowAbove) {
      const max = this.parseCompositeIndianAmount(belowAbove[1]);
      const min = this.parseCompositeIndianAmount(belowAbove[2]);
      if (min !== null && max !== null) {
        return {
          min: Math.min(min, max),
          max: Math.max(min, max),
        };
      }
    }

    const betweenPattern =
      /(?:between|from)\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)\s*(?:and|to|-)\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const between = moneyText.match(betweenPattern);
    if (between) {
      const left = this.parseCompositeIndianAmount(between[1]);
      const right = this.parseCompositeIndianAmount(between[2]);
      if (left !== null && right !== null) {
        return {
          min: Math.min(left, right),
          max: Math.max(left, right),
        };
      }
    }

    const partialBetweenPattern =
      /(?:between|from)\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const partialBetween = moneyText.match(partialBetweenPattern);
    if (partialBetween) {
      const min = this.parseCompositeIndianAmount(partialBetween[1]);
      if (min !== null) {
        return { min, max: null };
      }
    }

    const upperPattern =
      /(?:below|under|less than|upto|up to|within)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const upper = moneyText.match(upperPattern);
    const max = upper ? this.parseCompositeIndianAmount(upper[1]) : null;

    const lowerPattern =
      /(?:above|over|more than|greater than|starting from)\s*(?:inr|rs\.?|₹)?\s*([\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k)?(?:\s+[\d,\s.]+(?:crore|crores|lakh|lakhs|thousand|k))?)/i;
    const lower = moneyText.match(lowerPattern);
    const min = lower ? this.parseCompositeIndianAmount(lower[1]) : null;

    if (min !== null && max !== null) {
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
    }

    if (max !== null) {
      return { min: null, max };
    }

    if (min !== null) {
      return { min, max: null };
    }

    return empty;
  }

  private normalizeIndianAmountText(input: string) {
    return input
      .toLowerCase()
      .replace(/\blikes\b/g, "lakhs")
      .replace(/\blike\b/g, "lakh")
      .replace(/\blacs\b/g, "lakhs")
      .replace(/\blac\b/g, "lakh")
      .replace(/\s+/g, " ")
      .trim();
  }

  private parseAmountToInr(rawValue: string | undefined, unitValue: string | undefined) {
    if (!rawValue) {
      return null;
    }

    const raw = Number(rawValue.replace(/,/g, ""));
    if (!Number.isFinite(raw)) {
      return null;
    }

    const unit = (unitValue ?? "").toLowerCase();
    if (unit.startsWith("crore")) {
      return Math.round(raw * 10000000);
    }
    if (unit.startsWith("lakh")) {
      return Math.round(raw * 100000);
    }
    if (unit === "thousand" || unit === "k") {
      return Math.round(raw * 1000);
    }

    return Math.round(raw);
  }

  private describeBudgetRangeForSpeech(range: { min: number | null; max: number | null }) {
    if (range.min !== null && range.max !== null) {
      return `${this.formatCurrencyForSpeech(String(range.min), "INR")} to ${this.formatCurrencyForSpeech(String(range.max), "INR")}`;
    }

    if (range.max !== null) {
      return `below ${this.formatCurrencyForSpeech(String(range.max), "INR")}`;
    }

    if (range.min !== null) {
      return `above ${this.formatCurrencyForSpeech(String(range.min), "INR")}`;
    }

    return "current pricing";
  }

  private pickDistinctByModel(items: ProductSnapshot[]) {
    const seen = new Set<string>();
    const distinct: ProductSnapshot[] = [];

    for (const item of items) {
      const key = [item.brand, item.model, item.variant]
        .filter(Boolean)
        .join("|")
        .toLowerCase()
        .trim();
      const fallback = item.name.toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();
      const signature = key || fallback;

      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      distinct.push(item);
    }

    return distinct;
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
