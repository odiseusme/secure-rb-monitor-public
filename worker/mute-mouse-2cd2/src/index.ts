import { Hono } from "hono";
import type { Env } from "./types";

// Import the existing endpoint classes (we'll call their handle() directly)
import { CreateUser } from "./endpoints/createUser";
import { UpdateData } from "./endpoints/updateData";
import { GetBlob } from "./endpoints/getBlob";
import { DeleteUser } from "./endpoints/deleteUser";
import { CreateInvite } from "./endpoints/createInvite";
import { RegisterUser } from "./endpoints/registerUser";
import { AdminStats } from "./endpoints/adminStats";
import ServeDashboard from "./endpoints/serveDashboard";

// Create a plain Hono app (no OpenAPI/chanfana)
const app = new Hono<{ Bindings: Env }>();

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// === API routes (call each endpoint class's handle() method) ===

// Create a user (legacy helper; you can keep or remove if not needed)
app.post("/api/create-user", async (c) => {
  const endpoint = new CreateUser();
  return endpoint.handle(c);
});

// Update encrypted data blob (writer)
app.post("/api/update", async (c) => {
  const endpoint = new UpdateData();
  return endpoint.handle(c);
});

// Retrieve encrypted blob + user info (reader)
app.get("/api/blob/:publicId", async (c) => {
  const endpoint = new GetBlob();
  return endpoint.handle(c);
});

// Delete a user (admin-ish)
app.delete("/api/user/:publicId", async (c) => {
  const endpoint = new DeleteUser();
  return endpoint.handle(c);
});

// Create invite(s) (admin)
app.post("/api/admin/create-invite", async (c) => {
  const endpoint = new CreateInvite();
  return endpoint.handle(c);
});

// Register user with invite code
app.post("/api/register", async (c) => {
  const endpoint = new RegisterUser();
  return endpoint.handle(c);
});

// Admin stats
app.get("/api/admin/stats", async (c) => {
  const endpoint = new AdminStats();
  return endpoint.handle(c);
});

// Serve the dashboard HTML
// Serve the dashboard HTML (ServeDashboard is a function, not a class)
app.get("/d/:publicId", ServeDashboard);

// TEMPORARY: Fix user KDF params for dashboard decryption
app.post("/debug/fix-kdf/:publicId", async (c) => {
  const { publicId } = c.req.param();
  if (!publicId) return c.json({ error: "Missing publicId" }, 400);
  const userRaw = await c.env.USERS_KV.get(`user:${publicId}`);
  if (!userRaw) return c.json({ error: "User not found" }, 404);
  const user = JSON.parse(userRaw);
  user.kdfParams = {
    algorithm: "pbkdf2",
    iterations: 100000
  };
  await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(user));
  return c.json({ success: true, user });
});

// TEMPORARY: Debug endpoint to read any KV key (for dev only!)
app.get("/debug/kv/:key", async (c) => {
  const { key } = c.req.param();
  if (!key) return c.json({ error: "Missing key" }, 400);
  const value = await c.env.USERS_KV.get(key);
  if (!value) return c.json({ error: "Not found" }, 404);
  return c.json({ key, value });
});

// Export the app as the Worker
export default app;
