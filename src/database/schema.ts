import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const callStatusEnum = pgEnum("call_status", [
  "initiated",
  "in_progress",
  "completed",
  "failed",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "lost",
]);

export const planCodeEnum = pgEnum("plan_code", ["starter", "growth", "pro"]);

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    businessPhoneNumber: varchar("business_phone_number", { length: 20 }).notNull(),
    virtualPhoneNumber: varchar("virtual_phone_number", { length: 20 }),
    exotelNumber: varchar("exotel_number", { length: 20 }),
    planCode: planCodeEnum("plan_code").notNull().default("starter"),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("businesses_slug_idx").on(table.slug),
    businessPhoneIdx: uniqueIndex("businesses_business_phone_idx").on(table.businessPhoneNumber),
    virtualPhoneIdx: uniqueIndex("businesses_virtual_phone_idx").on(table.virtualPhoneNumber),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessFaqIdx: index("faqs_business_idx").on(table.businessId),
  }),
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessServiceIdx: index("services_business_idx").on(table.businessId),
  }),
);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    exotelCallSid: varchar("exotel_call_sid", { length: 100 }),
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
    businessCallIdx: index("calls_business_idx").on(table.businessId),
    exotelCallIdx: uniqueIndex("calls_exotel_call_sid_idx").on(table.exotelCallSid),
  }),
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    callId: uuid("call_id"),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 20 }).notNull(),
    intent: text("intent"),
    notes: text("notes"),
    status: leadStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessLeadIdx: index("leads_business_idx").on(table.businessId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    leadId: uuid("lead_id"),
    callId: uuid("call_id"),
    channel: varchar("channel", { length: 30 }).notNull().default("whatsapp"),
    recipient: varchar("recipient", { length: 20 }).notNull(),
    body: text("body").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    status: varchar("status", { length: 30 }).notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessMessageIdx: index("messages_business_idx").on(table.businessId),
  }),
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    callId: uuid("call_id"),
    minutesUsed: numeric("minutes_used", { precision: 10, scale: 2 }).notNull().default("0"),
    estimatedCostInr: numeric("estimated_cost_inr", { precision: 10, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessUsageIdx: index("usage_records_business_idx").on(table.businessId),
  }),
);

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type ServiceEntry = typeof services.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Lead = typeof leads.$inferSelect;
