import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});

// Dev-only convenience binding for local root route
export interface Env { PUBLIC_ID?: string; }

// Dev-only flags (used in local development)
export interface Env {
  /** If "true", /d/:publicId will skip KV existence check and serve the dashboard directly (LOCAL DEV ONLY). */
  BYPASS_KV_DASHBOARD?: string;
}
