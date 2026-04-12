DO $$ BEGIN
 CREATE TYPE "public"."call_request_status" AS ENUM('pending', 'approved', 'rejected', 'callback_scheduled', 'callback_completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_request_type" AS ENUM('order', 'preorder', 'book_table', 'callback_request', 'general');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_status" AS ENUM('initiated', 'in_progress', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_turn_speaker" AS ENUM('customer', 'agent');
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
 CREATE TYPE "public"."product_category" AS ENUM('car', 'bike', 'scooter', 'fridge', 'ac', 'washing_machine', 'tv', 'mobile', 'furniture', 'other');
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
 CREATE TYPE "public"."product_status" AS ENUM('draft', 'available', 'reserved', 'sold', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."service_type" AS ENUM('car_dealer', 'appliance_store', 'electronics_store', 'mixed_inventory', 'other');
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
 CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'staff');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "businesses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_name" varchar(150) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"service_type" "service_type" DEFAULT 'mixed_inventory' NOT NULL,
	"contact_number" varchar(20) NOT NULL,
	"primary_email" varchar(255),
	"primary_mobile" varchar(20),
	"city" varchar(100),
	"state" varchar(100),
	"address" text,
	"voice_agent_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"business_id" bigint NOT NULL,
	"from_number" varchar(20) NOT NULL,
	"customer_name" varchar(160),
	"customer_mobile" varchar(20),
	"summary" text NOT NULL,
	"request_type" "call_request_type" DEFAULT 'general' NOT NULL,
	"status" "call_request_status" DEFAULT 'pending' NOT NULL,
	"approval_note" text,
	"approved_at" timestamp with time zone,
	"messaged_to_customer" boolean DEFAULT false NOT NULL,
	"messaged_at" timestamp with time zone,
	"called_back" boolean DEFAULT false NOT NULL,
	"called_back_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
	"from_number" varchar(20) NOT NULL,
	"to_number" varchar(20) NOT NULL,
	"original_business_number" varchar(20),
	"status" "call_status" DEFAULT 'initiated' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"transcript" text,
	"summary" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
	"name" varchar(180) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"category" "product_category" NOT NULL,
	"condition" "product_condition" DEFAULT 'used' NOT NULL,
	"status" "product_status" DEFAULT 'available' NOT NULL,
	"sku" varchar(80),
	"brand" varchar(120),
	"model" varchar(120),
	"variant" varchar(120),
	"price" varchar(30) NOT NULL,
	"discount_price" varchar(30),
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
	"is_featured" boolean DEFAULT false NOT NULL,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"business_id" bigint NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
 ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_slug_unique" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_contact_number_unique" ON "businesses" USING btree ("contact_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_business_id_idx" ON "call_requests" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_call_id_idx" ON "call_requests" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_requests_status_idx" ON "call_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_turns_call_id_idx" ON "call_turns" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_business_id_idx" ON "calls" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calls_exotel_call_sid_unique" ON "calls" USING btree ("exotel_call_sid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_business_slug_unique" ON "products" USING btree ("business_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_mobile_unique" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_business_id_idx" ON "users" USING btree ("business_id");