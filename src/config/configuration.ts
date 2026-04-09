import { envSchema, type Env } from "./env.schema";

export function configuration(): Env {
  return envSchema.parse(process.env);
}
