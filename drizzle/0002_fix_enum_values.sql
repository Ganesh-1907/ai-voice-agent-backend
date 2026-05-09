ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'super_admin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'owner';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'staff';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'rejected';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'callback_scheduled';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'callback_completed';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'called';
--> statement-breakpoint
ALTER TYPE "public"."call_request_status" ADD VALUE IF NOT EXISTS 'not_called';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'order';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'preorder';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'book_table';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'callback_request';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'enquiry';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'booking';
--> statement-breakpoint
ALTER TYPE "public"."call_request_type" ADD VALUE IF NOT EXISTS 'general';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'enquiry';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'booking';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'callback';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'order';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'preorder';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'book_table';
--> statement-breakpoint
ALTER TYPE "public"."lead_type" ADD VALUE IF NOT EXISTS 'general';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'new';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'contacted';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'qualified';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'booked';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'closed';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'lost';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'initiated';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'answered';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'missed';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE IF NOT EXISTS 'failed';
--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'accepted';
--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'rejected';
--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'starter';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'growth';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'pro';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'basic';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'professional';
--> statement-breakpoint
ALTER TYPE "public"."plan_code" ADD VALUE IF NOT EXISTS 'enterprise';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'car_dealer';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'appliance_store';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'electronics_store';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'mixed_inventory';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'restaurant';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'fashion';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'furniture';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'service_business';
--> statement-breakpoint
ALTER TYPE "public"."service_type" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE IF NOT EXISTS 'active';
--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE IF NOT EXISTS 'paused';
--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE IF NOT EXISTS 'inactive';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'active';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'available';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'reserved';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'sold';
--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE IF NOT EXISTS 'inactive';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'car';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'bike';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'scooter';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'fridge';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'ac';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'washing_machine';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'tv';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'mobile';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'furniture';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'fashion';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'restaurant';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'service';
--> statement-breakpoint
ALTER TYPE "public"."product_category" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
ALTER TYPE "public"."product_condition" ADD VALUE IF NOT EXISTS 'new';
--> statement-breakpoint
ALTER TYPE "public"."product_condition" ADD VALUE IF NOT EXISTS 'used';
--> statement-breakpoint
ALTER TYPE "public"."product_condition" ADD VALUE IF NOT EXISTS 'refurbished';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'petrol';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'diesel';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'electric';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'hybrid';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'cng';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'lpg';
--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
ALTER TYPE "public"."transmission_type" ADD VALUE IF NOT EXISTS 'manual';
--> statement-breakpoint
ALTER TYPE "public"."transmission_type" ADD VALUE IF NOT EXISTS 'automatic';
--> statement-breakpoint
ALTER TYPE "public"."transmission_type" ADD VALUE IF NOT EXISTS 'semi_automatic';
--> statement-breakpoint
ALTER TYPE "public"."transmission_type" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE IF NOT EXISTS 'product';
--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE IF NOT EXISTS 'service';
