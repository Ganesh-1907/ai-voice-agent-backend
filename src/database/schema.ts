import {
  bigserial,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const serviceTypeEnum = pgEnum("service_type", [
  "car_dealer",
  "appliance_store",
  "electronics_store",
  "mixed_inventory",
  "other",
]);

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "staff"]);
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
  "other",
]);
export const productConditionEnum = pgEnum("product_condition", ["new", "used", "refurbished"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "available", "reserved", "sold", "inactive"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["petrol", "diesel", "electric", "hybrid", "cng", "lpg", "other"]);
export const transmissionTypeEnum = pgEnum("transmission_type", ["manual", "automatic", "semi_automatic", "other"]);
export const callStatusEnum = pgEnum("call_status", ["initiated", "in_progress", "completed", "failed"]);
export const callTurnSpeakerEnum = pgEnum("call_turn_speaker", ["customer", "agent"]);
export const callRequestTypeEnum = pgEnum("call_request_type", ["order", "preorder", "book_table", "callback_request", "general"]);
export const callRequestStatusEnum = pgEnum("call_request_status", [
  "pending",
  "approved",
  "rejected",
  "callback_scheduled",
  "callback_completed",
]);

export const businesses = pgTable(
  "businesses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessName: varchar("business_name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    serviceType: serviceTypeEnum("service_type").notNull().default("mixed_inventory"),
    contactNumber: varchar("contact_number", { length: 20 }).notNull(),
    primaryEmail: varchar("primary_email", { length: 255 }),
    primaryMobile: varchar("primary_mobile", { length: 20 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    address: text("address"),
    voiceAgentEnabled: boolean("voice_agent_enabled").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("businesses_slug_unique").on(table.slug),
    contactIdx: uniqueIndex("businesses_contact_number_unique").on(table.contactNumber),
  }),
);

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    mobile: varchar("mobile", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("owner"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_unique").on(table.email),
    mobileIdx: uniqueIndex("users_mobile_unique").on(table.mobile),
    businessIdx: index("users_business_id_idx").on(table.businessId),
  }),
);

export const products = pgTable(
  "products",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description"),
    category: productCategoryEnum("category").notNull(),
    condition: productConditionEnum("condition").notNull().default("used"),
    status: productStatusEnum("status").notNull().default("available"),
    sku: varchar("sku", { length: 80 }),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 120 }),
    variant: varchar("variant", { length: 120 }),
    price: varchar("price", { length: 30 }).notNull(),
    discountPrice: varchar("discount_price", { length: 30 }),
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
    isFeatured: boolean("is_featured").notNull().default(false),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessSlugIdx: uniqueIndex("products_business_slug_unique").on(table.businessId, table.slug),
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

export const calls = pgTable(
  "calls",
  {
    id: text("id").primaryKey(),
    businessId: bigint("business_id", { mode: "number" })
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    exotelCallSid: varchar("exotel_call_sid", { length: 120 }),
    fromNumber: varchar("from_number", { length: 20 }).notNull(),
    toNumber: varchar("to_number", { length: 20 }).notNull(),
    originalBusinessNumber: varchar("original_business_number", { length: 20 }),
    status: callStatusEnum("status").notNull().default("initiated"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    transcript: text("transcript"),
    summary: text("summary"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("calls_business_id_idx").on(table.businessId),
    exotelSidIdx: uniqueIndex("calls_exotel_call_sid_unique").on(table.exotelCallSid),
    statusIdx: index("calls_status_idx").on(table.status),
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
    fromNumber: varchar("from_number", { length: 20 }).notNull(),
    customerName: varchar("customer_name", { length: 160 }),
    customerMobile: varchar("customer_mobile", { length: 20 }),
    summary: text("summary").notNull(),
    requestType: callRequestTypeEnum("request_type").notNull().default("general"),
    status: callRequestStatusEnum("status").notNull().default("pending"),
    approvalNote: text("approval_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    messagedToCustomer: boolean("messaged_to_customer").notNull().default(false),
    messagedAt: timestamp("messaged_at", { withTimezone: true }),
    calledBack: boolean("called_back").notNull().default(false),
    calledBackAt: timestamp("called_back_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("call_requests_business_id_idx").on(table.businessId),
    callIdx: index("call_requests_call_id_idx").on(table.callId),
    statusIdx: index("call_requests_status_idx").on(table.status),
  }),
);

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
