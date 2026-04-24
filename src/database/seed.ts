import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { users } from "./schema";

const SUPER_ADMIN_EMAIL = "superadmin@gmail.com";
const SUPER_ADMIN_PASSWORD = "admin@123";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed");
  }

  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  try {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    const now = new Date();

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, SUPER_ADMIN_EMAIL))
      .limit(1);

    if (existingUser) {
      await db
        .update(users)
        .set({
          name: "Super Admin",
          passwordHash,
          role: "super_admin",
          status: "active",
          isActive: true,
          businessId: null,
          updatedAt: now,
        })
        .where(eq(users.id, existingUser.id));

      console.log(`Updated super admin: ${SUPER_ADMIN_EMAIL}`);
      return;
    }

    await db.insert(users).values({
      name: "Super Admin",
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      role: "super_admin",
      status: "active",
      isActive: true,
      businessId: null,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Created super admin: ${SUPER_ADMIN_EMAIL}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
