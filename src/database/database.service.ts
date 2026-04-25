import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { configuration } from "../config/configuration";
import * as relations from "./relations";
import * as tables from "./schema";

const schema = { ...tables, ...relations };

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly env = configuration();
  private readonly client = postgres(this.env.DATABASE_URL, {
    prepare: false,
  });

  readonly db: PostgresJsDatabase<typeof schema> = drizzle(this.client, { schema });

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}
