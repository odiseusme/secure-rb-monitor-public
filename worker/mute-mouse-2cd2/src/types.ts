import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

// Environment bindings interface for Cloudflare Worker
export interface Env {
  USERS_KV: KVNamespace;
  ADMIN_API_KEY: string;
  ENVIRONMENT: "development" | "production";
}

export type AppContext = Context<{ Bindings: Env }>;

// Legacy task schema (not used in current endpoints; kept for possible future features)
export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});
