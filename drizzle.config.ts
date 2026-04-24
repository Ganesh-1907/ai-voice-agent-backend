import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
