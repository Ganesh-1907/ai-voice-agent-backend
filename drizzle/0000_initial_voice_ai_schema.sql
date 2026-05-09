DO $$ BEGIN
 CREATE TYPE "public"."account_status" AS ENUM('active', 'paused', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_request_status" AS ENUM('pending', 'approved', 'rejected', 'callback_scheduled', 'callback_completed', 'called', 'not_called');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_request_type" AS ENUM('order', 'preorder', 'book_table', 'callback_request', 'enquiry', 'booking', 'general');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_status" AS ENUM('initiated', 'in_progress', 'answered', 'missed', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_turn_speaker" AS ENUM('customer', 'agent', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."item_type" AS ENUM('product', 'service');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'booked', 'closed', 'cancelled', 'lost');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lead_type" AS ENUM('enquiry', 'booking', 'callback', 'order', 'preorder', 'book_table', 'general');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."plan_code" AS ENUM('starter', 'growth', 'pro', 'basic', 'professional', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_category" AS ENUM('car', 'bike', 'scooter', 'fridge', 'ac', 'washing_machine', 'tv', 'mobile', 'furniture', 'fashion', 'restaurant', 'service', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_condition" AS ENUM('new', 'used', 'refurbished');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'available', 'reserved', 'sold', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."service_type" AS ENUM('car_dealer', 'appliance_store', 'electronics_store', 'mixed_inventory', 'restaurant', 'fashion', 'furniture', 'service_business', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transmission_type" AS ENUM('manual', 'automatic', 'semi_automatic', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'owner', 'admin', 'staff');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_faqs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"opening_time" time,
	"closing_time" time,
	"working_days" text[] DEFAULT '{}' NOT NULL,
	"booking_enabled" boolean DEFAULT true NOT NULL,
	"auto_answer_enabled" boolean DEFAULT true NOT NULL,
	"ai_instructions" text,
	"welcome_message" text,
	"fallback_message" text,
	"collect_customer_name" boolean DEFAULT true NOT NULL,
	"collect_customer_phone" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "businesses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_user_id" bigint,
	"business_name" varchar(150) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"service_type" "service_type" DEFAULT 'mixed_inventory' NOT NULL,
	"business_type" varchar(80),
	"contact_number" varchar(30) NOT NULL,
	"primary_email" varchar(255),
	"primary_mobile" varchar(30),
	"forwarding_number" varchar(30),
	"ai_agent_phone_number" varchar(30),
	"city" varchar(100),
	"state" varchar(100),
	"address" text,
	"google_map_link" text,
	"plan_code" "plan_code" DEFAULT 'starter' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"voice_agent_enabled" boolean DEFAULT true NOT NULL,
	"calls_included" integer DEFAULT 0 NOT NULL,
	"calls_used" integer DEFAULT 0 NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "owner_user_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"business_id" bigint NOT NULL,
	"product_id" bigint,
	"from_number" varchar(30) NOT NULL,
	"customer_name" varchar(160),
	"customer_mobile" varchar(30),
	"customer_email" varchar(255),
	"summary" text NOT NULL,
	"transcript" text,
	"request_type" "call_request_type" DEFAULT 'general' NOT NULL,
	"status" "call_request_status" DEFAULT 'pending' NOT NULL,
	"approval_note" text,
	"approved_at" timestamp with time zone,
	"messaged_to_customer" boolean DEFAULT false NOT NULL,
	"messaged_at" timestamp with time zone,
	"called_back" boolean DEFAULT false NOT NULL,
	"called_back_at" timestamp with time zone,
	"preferred_date" date,
	"preferred_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_requests" ADD COLUMN IF NOT EXISTS "product_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_turns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"speaker" "call_turn_speaker" NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"exotel_call_sid" varchar(120),
	"from_number" varchar(30) NOT NULL,
	"to_number" varchar(30) NOT NULL,
	"original_business_number" varchar(30),
	"customer_name" varchar(160),
	"customer_phone" varchar(30),
	"status" "call_status" DEFAULT 'initiated' NOT NULL,
	"read_status" varchar(20) DEFAULT 'unread' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"transcript" text,
	"summary" text,
	"recording_url" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint,
	"parent_id" bigint,
	"name" varchar(140) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"item_type" "item_type" DEFAULT 'product' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "business_id" bigint;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"call_id" text,
	"product_id" bigint,
	"customer_name" varchar(160),
	"customer_phone" varchar(30) NOT NULL,
	"customer_email" varchar(255),
	"lead_type" "lead_type" DEFAULT 'enquiry' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"summary" text,
	"transcript" text,
	"preferred_date" date,
	"preferred_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "call_id" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "product_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"call_id" text,
	"product_id" bigint,
	"customer_name" varchar(160),
	"customer_number" varchar(30) NOT NULL,
	"customer_email" varchar(255),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"transcript" text,
	"notes" text,
	"reject_reason" text,
	"preferred_date" date,
	"preferred_time" time,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "call_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "product_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_features" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"feature_name" varchar(140) NOT NULL,
	"feature_value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_images" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"image_url" text NOT NULL,
	"alt_text" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"category_id" bigint,
	"name" varchar(180) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"category" "product_category" DEFAULT 'other' NOT NULL,
	"item_type" "item_type" DEFAULT 'product' NOT NULL,
	"condition" "product_condition" DEFAULT 'used',
	"status" "product_status" DEFAULT 'available' NOT NULL,
	"sku" varchar(80),
	"brand" varchar(120),
	"model" varchar(120),
	"variant" varchar(120),
	"price" numeric(12, 2) NOT NULL,
	"discount_price" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"stock_quantity" integer DEFAULT 1 NOT NULL,
	"manufacture_year" integer,
	"registration_year" integer,
	"purchase_year" integer,
	"mileage_km" integer,
	"fuel_type" "fuel_type",
	"transmission" "transmission_type",
	"color" varchar(60),
	"location_city" varchar(100),
	"location_state" varchar(100),
	"condition_notes" text,
	"search_tags" text[] DEFAULT '{}' NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_negotiable" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" bigint;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"mobile" varchar(30),
	"name" varchar(120) NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_id" bigint;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_faqs" ADD CONSTRAINT "business_faqs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_turns" ADD CONSTRAINT "call_turns_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calls" ADD CONSTRAINT "calls_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_features" ADD CONSTRAINT "product_features_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_faqs_business_id_idx" ON "business_faqs" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "business_settings_business_id_unique" ON "business_settings" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_slug_unique" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_contact_number_unique" ON "businesses" USING btree ("contact_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_owner_user_id_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_business_id_idx" ON "call_requests" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_call_id_idx" ON "call_requests" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_product_id_idx" ON "call_requests" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_status_idx" ON "call_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_request_type_idx" ON "call_requests" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_turns_call_id_idx" ON "call_turns" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_business_id_idx" ON "calls" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calls_exotel_call_sid_unique" ON "calls" USING btree ("exotel_call_sid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_read_status_idx" ON "calls" USING btree ("read_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_business_id_idx" ON "categories" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_business_slug_unique" ON "categories" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_business_id_idx" ON "leads" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_call_id_idx" ON "leads" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_product_id_idx" ON "leads" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_business_id_idx" ON "orders" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_call_id_idx" ON "orders" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_product_id_idx" ON "orders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_features_product_id_idx" ON "product_features" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_business_slug_unique" ON "products" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_business_id_idx" ON "products" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_item_type_idx" ON "products" USING btree ("item_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_mobile_idx" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_business_id_idx" ON "users" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");
