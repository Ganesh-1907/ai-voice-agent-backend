import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigserial,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["super_admin", "owner", "admin", "staff"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "paused", "inactive"]);
export const planCodeEnum = pgEnum("plan_code", ["starter", "growth", "pro", "basic", "professional", "enterprise"]);

export const serviceTypeEnum = pgEnum("service_type", [
  "car_dealer",
  "appliance_store",
  "electronics_store",
  "mixed_inventory",
  "restaurant",
  "fashion",
  "furniture",
  "service_business",
  "other",
]);

export const itemTypeEnum = pgEnum("item_type", ["product", "service"]);
export const productCategoryEnum = pgEnum("product_category", [
  "car",
  "bike",
  "scooter",
  "fridge",
  "ac",
  "washing_machine",
  "tv",
  "mobile",
  "furniture",
  "fashion",
  "restaurant",
  "service",
  "other",
]);
export const productConditionEnum = pgEnum("product_condition", ["new", "used", "refurbished"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "active", "available", "reserved", "sold", "inactive"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["petrol", "diesel", "electric", "hybrid", "cng", "lpg", "other"]);
export const transmissionTypeEnum = pgEnum("transmission_type", ["manual", "automatic", "semi_automatic", "other"]);

export const callStatusEnum = pgEnum("call_status", ["initiated", "in_progress", "answered", "missed", "completed", "failed"]);
export const callTurnSpeakerEnum = pgEnum("call_turn_speaker", ["customer", "agent", "system"]);
export const leadTypeEnum = pgEnum("lead_type", ["enquiry", "booking", "callback", "order", "preorder", "book_table", "general"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "booked", "closed", "cancelled", "lost"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "accepted", "rejected", "cancelled"]);
export const callRequestTypeEnum = pgEnum("call_request_type", [
  "order",
  "preorder",
  "book_table",
  "callback_request",
  "enquiry",
  "booking",
  "general",
]);
export const callRequestStatusEnum = pgEnum("call_request_status", [
  "pending",
  "approved",
  "rejected",
  "callback_scheduled",
  "callback_completed",
  "called",
  "not_called",
]);

export const businesses = pgTable(
  "businesses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerUserId: bigint("owner_user_id", { mode: "number" }).references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    businessName: varchar("business_name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    serviceType: serviceTypeEnum("service_type").notNull().default("mixed_inventory"),
    businessType: varchar("business_type", { length: 80 }),
    contactNumber: varchar("contact_number", { length: 30 }).notNull(),
    primaryEmail: varchar("primary_email", { length: 255 }),
    primaryMobile: varchar("primary_mobile", { length: 30 }),
    forwardingNumber: varchar("forwarding_number", { length: 30 }),
    aiAgentPhoneNumber: varchar("ai_agent_phone_number", { length: 30 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    address: text("address"),
    googleMapLink: text("google_map_link"),
    planCode: planCodeEnum("plan_code").notNull().default("starter"),
    status: accountStatusEnum("status").notNull().default("active"),
    voiceAgentEnabled: boolean("voice_agent_enabled").notNull().default(true),
    callsIncluded: integer("calls_included").notNull().default(0),
    callsUsed: integer("calls_used").notNull().default(0),
    planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("businesses_slug_unique").on(table.slug),
    contactIdx: uniqueIndex("businesses_contact_number_unique").on(table.contactNumber),
    ownerIdx: index("businesses_owner_user_id_idx").on(table.ownerUserId),
    statusIdx: index("businesses_status_idx").on(table.status),
  }),
);

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" }).references(() => businesses.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    mobile: varchar("mobile", { length: 30 }),
    name: varchar("name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("owner"),
    status: accountStatusEnum("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(true),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_unique").on(table.email),
    mobileIdx: index("users_mobile_idx").on(table.mobile),
    businessIdx: index("users_business_id_idx").on(table.businessId),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const businessSettings = pgTable(
  "business_settings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    openingTime: time("opening_time"),
    closingTime: time("closing_time"),
    workingDays: text("working_days").array().notNull().default([]),
    bookingEnabled: boolean("booking_enabled").notNull().default(true),
    autoAnswerEnabled: boolean("auto_answer_enabled").notNull().default(true),
    aiInstructions: text("ai_instructions"),
    welcomeMessage: text("welcome_message"),
    fallbackMessage: text("fallback_message"),
    collectCustomerName: boolean("collect_customer_name").notNull().default(true),
    collectCustomerPhone: boolean("collect_customer_phone").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: uniqueIndex("business_settings_business_id_unique").on(table.businessId),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" }).references(() => businesses.id, { onDelete: "cascade" }),
    parentId: bigint("parent_id", { mode: "number" }).references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    itemType: itemTypeEnum("item_type").notNull().default("product"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("categories_business_id_idx").on(table.businessId),
    parentIdx: index("categories_parent_id_idx").on(table.parentId),
    slugIdx: uniqueIndex("categories_business_slug_unique").on(table.businessId, table.slug),
  }),
);

export const products = pgTable(
  "products",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: bigint("category_id", { mode: "number" }).references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description"),
    category: productCategoryEnum("category").notNull().default("other"),
    itemType: itemTypeEnum("item_type").notNull().default("product"),
    condition: productConditionEnum("condition").default("used"),
    status: productStatusEnum("status").notNull().default("available"),
    sku: varchar("sku", { length: 80 }),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 120 }),
    variant: varchar("variant", { length: 120 }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    discountPrice: numeric("discount_price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    stockQuantity: integer("stock_quantity").notNull().default(1),
    manufactureYear: integer("manufacture_year"),
    registrationYear: integer("registration_year"),
    purchaseYear: integer("purchase_year"),
    mileageKm: integer("mileage_km"),
    fuelType: fuelTypeEnum("fuel_type"),
    transmission: transmissionTypeEnum("transmission"),
    color: varchar("color", { length: 60 }),
    locationCity: varchar("location_city", { length: 100 }),
    locationState: varchar("location_state", { length: 100 }),
    conditionNotes: text("condition_notes"),
    searchTags: text("search_tags").array().notNull().default([]),
    specifications: jsonb("specifications").$type<Record<string, unknown>>().notNull().default({}),
    isNegotiable: boolean("is_negotiable").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessSlugIdx: uniqueIndex("products_business_slug_unique").on(table.businessId, table.slug),
    businessIdx: index("products_business_id_idx").on(table.businessId),
    categoryIdx: index("products_category_id_idx").on(table.categoryId),
    statusIdx: index("products_status_idx").on(table.status),
    itemTypeIdx: index("products_item_type_idx").on(table.itemType),
  }),
);

export const productFeatures = pgTable(
  "product_features",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    featureName: varchar("feature_name", { length: 140 }).notNull(),
    featureValue: text("feature_value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("product_features_product_id_idx").on(table.productId),
  }),
);

export const productImages = pgTable(
  "product_images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    altText: varchar("alt_text", { length: 255 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("product_images_product_id_idx").on(table.productId),
  }),
);

export const businessFaqs = pgTable(
  "business_faqs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("business_faqs_business_id_idx").on(table.businessId),
  }),
);

export const calls = pgTable(
  "calls",
  {
    id: text("id").primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    exotelCallSid: varchar("exotel_call_sid", { length: 120 }),
    fromNumber: varchar("from_number", { length: 30 }).notNull(),
    toNumber: varchar("to_number", { length: 30 }).notNull(),
    originalBusinessNumber: varchar("original_business_number", { length: 30 }),
    customerName: varchar("customer_name", { length: 160 }),
    customerPhone: varchar("customer_phone", { length: 30 }),
    status: callStatusEnum("status").notNull().default("initiated"),
    readStatus: varchar("read_status", { length: 20 }).notNull().default("unread"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    transcript: text("transcript"),
    summary: text("summary"),
    recordingUrl: text("recording_url"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("calls_business_id_idx").on(table.businessId),
    exotelSidIdx: uniqueIndex("calls_exotel_call_sid_unique").on(table.exotelCallSid),
    statusIdx: index("calls_status_idx").on(table.status),
    readStatusIdx: index("calls_read_status_idx").on(table.readStatus),
  }),
);

export const callTurns = pgTable(
  "call_turns",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    callId: text("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    speaker: callTurnSpeakerEnum("speaker").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    callIdx: index("call_turns_call_id_idx").on(table.callId),
  }),
);

export const leads = pgTable(
  "leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    callId: text("call_id").references(() => calls.id, { onDelete: "set null" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 160 }),
    customerPhone: varchar("customer_phone", { length: 30 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    leadType: leadTypeEnum("lead_type").notNull().default("enquiry"),
    status: leadStatusEnum("status").notNull().default("new"),
    notes: text("notes"),
    summary: text("summary"),
    transcript: text("transcript"),
    preferredDate: date("preferred_date"),
    preferredTime: time("preferred_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("leads_business_id_idx").on(table.businessId),
    callIdx: index("leads_call_id_idx").on(table.callId),
    productIdx: index("leads_product_id_idx").on(table.productId),
    statusIdx: index("leads_status_idx").on(table.status),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    callId: text("call_id").references(() => calls.id, { onDelete: "set null" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 160 }),
    customerNumber: varchar("customer_number", { length: 30 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    status: orderStatusEnum("status").notNull().default("pending"),
    summary: text("summary"),
    transcript: text("transcript"),
    notes: text("notes"),
    rejectReason: text("reject_reason"),
    preferredDate: date("preferred_date"),
    preferredTime: time("preferred_time"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("orders_business_id_idx").on(table.businessId),
    callIdx: index("orders_call_id_idx").on(table.callId),
    productIdx: index("orders_product_id_idx").on(table.productId),
    statusIdx: index("orders_status_idx").on(table.status),
  }),
);

export const callRequests = pgTable(
  "call_requests",
  {
    id: text("id").primaryKey(),
    callId: text("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id, { onDelete: "set null" }),
    fromNumber: varchar("from_number", { length: 30 }).notNull(),
    customerName: varchar("customer_name", { length: 160 }),
    customerMobile: varchar("customer_mobile", { length: 30 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    summary: text("summary").notNull(),
    transcript: text("transcript"),
    requestType: callRequestTypeEnum("request_type").notNull().default("general"),
    status: callRequestStatusEnum("status").notNull().default("pending"),
    approvalNote: text("approval_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    messagedToCustomer: boolean("messaged_to_customer").notNull().default(false),
    messagedAt: timestamp("messaged_at", { withTimezone: true }),
    calledBack: boolean("called_back").notNull().default(false),
    calledBackAt: timestamp("called_back_at", { withTimezone: true }),
    preferredDate: date("preferred_date"),
    preferredTime: time("preferred_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("call_requests_business_id_idx").on(table.businessId),
    callIdx: index("call_requests_call_id_idx").on(table.callId),
    productIdx: index("call_requests_product_id_idx").on(table.productId),
    statusIdx: index("call_requests_status_idx").on(table.status),
    requestTypeIdx: index("call_requests_request_type_idx").on(table.requestType),
  }),
);

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Order = typeof orders.$inferSelect;
