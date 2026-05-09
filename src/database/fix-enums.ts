import postgres from "postgres";

const enumFixes: { type: string; value: string }[] = [
  { type: "user_role", value: "super_admin" },
  { type: "user_role", value: "owner" },
  { type: "user_role", value: "admin" },
  { type: "user_role", value: "staff" },
  { type: "call_request_status", value: "pending" },
  { type: "call_request_status", value: "approved" },
  { type: "call_request_status", value: "rejected" },
  { type: "call_request_status", value: "callback_scheduled" },
  { type: "call_request_status", value: "callback_completed" },
  { type: "call_request_status", value: "called" },
  { type: "call_request_status", value: "not_called" },
  { type: "call_request_type", value: "order" },
  { type: "call_request_type", value: "preorder" },
  { type: "call_request_type", value: "book_table" },
  { type: "call_request_type", value: "callback_request" },
  { type: "call_request_type", value: "enquiry" },
  { type: "call_request_type", value: "booking" },
  { type: "call_request_type", value: "general" },
  { type: "lead_type", value: "enquiry" },
  { type: "lead_type", value: "booking" },
  { type: "lead_type", value: "callback" },
  { type: "lead_type", value: "order" },
  { type: "lead_type", value: "preorder" },
  { type: "lead_type", value: "book_table" },
  { type: "lead_type", value: "general" },
  { type: "lead_status", value: "new" },
  { type: "lead_status", value: "contacted" },
  { type: "lead_status", value: "qualified" },
  { type: "lead_status", value: "booked" },
  { type: "lead_status", value: "closed" },
  { type: "lead_status", value: "cancelled" },
  { type: "lead_status", value: "lost" },
  { type: "call_status", value: "initiated" },
  { type: "call_status", value: "in_progress" },
  { type: "call_status", value: "answered" },
  { type: "call_status", value: "missed" },
  { type: "call_status", value: "completed" },
  { type: "call_status", value: "failed" },
  { type: "order_status", value: "pending" },
  { type: "order_status", value: "accepted" },
  { type: "order_status", value: "rejected" },
  { type: "order_status", value: "cancelled" },
  { type: "plan_code", value: "starter" },
  { type: "plan_code", value: "growth" },
  { type: "plan_code", value: "pro" },
  { type: "plan_code", value: "basic" },
  { type: "plan_code", value: "professional" },
  { type: "plan_code", value: "enterprise" },
  { type: "account_status", value: "active" },
  { type: "account_status", value: "paused" },
  { type: "account_status", value: "inactive" },
  { type: "service_type", value: "car_dealer" },
  { type: "service_type", value: "appliance_store" },
  { type: "service_type", value: "electronics_store" },
  { type: "service_type", value: "mixed_inventory" },
  { type: "service_type", value: "restaurant" },
  { type: "service_type", value: "fashion" },
  { type: "service_type", value: "furniture" },
  { type: "service_type", value: "service_business" },
  { type: "service_type", value: "other" },
  { type: "product_status", value: "draft" },
  { type: "product_status", value: "active" },
  { type: "product_status", value: "available" },
  { type: "product_status", value: "reserved" },
  { type: "product_status", value: "sold" },
  { type: "product_status", value: "inactive" },
  { type: "product_category", value: "car" },
  { type: "product_category", value: "bike" },
  { type: "product_category", value: "scooter" },
  { type: "product_category", value: "fridge" },
  { type: "product_category", value: "ac" },
  { type: "product_category", value: "washing_machine" },
  { type: "product_category", value: "tv" },
  { type: "product_category", value: "mobile" },
  { type: "product_category", value: "furniture" },
  { type: "product_category", value: "fashion" },
  { type: "product_category", value: "restaurant" },
  { type: "product_category", value: "service" },
  { type: "product_category", value: "other" },
  { type: "product_condition", value: "new" },
  { type: "product_condition", value: "used" },
  { type: "product_condition", value: "refurbished" },
  { type: "fuel_type", value: "petrol" },
  { type: "fuel_type", value: "diesel" },
  { type: "fuel_type", value: "electric" },
  { type: "fuel_type", value: "hybrid" },
  { type: "fuel_type", value: "cng" },
  { type: "fuel_type", value: "lpg" },
  { type: "fuel_type", value: "other" },
  { type: "transmission_type", value: "manual" },
  { type: "transmission_type", value: "automatic" },
  { type: "transmission_type", value: "semi_automatic" },
  { type: "transmission_type", value: "other" },
  { type: "item_type", value: "product" },
  { type: "item_type", value: "service" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const client = postgres(databaseUrl, { prepare: false, max: 1 });

  let added = 0;
  let skipped = 0;

  for (const { type, value } of enumFixes) {
    try {
      // Each query runs in its own implicit transaction (auto-commit)
      await client.unsafe(`ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS '${value}'`);
      added++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // "cannot be executed from a function" means it's in a transaction context — skip safely
      if (msg.includes("cannot") || msg.includes("does not exist")) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  await client.end();
  console.log(`Enum fix complete: ${added} statements run, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
