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

import {
  DASHBOARD_HTML,
  STYLE_CSS,
  FAVICON_ICO_BASE64,
  OWL_ICON_32_BASE64,
  OWL_ICON_180_BASE64,
  MANIFEST_JSON
} from "./assets";

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

// Serve the dashboard HTML (ServeDashboard is a function, not a class)
app.get("/d/:publicId", ServeDashboard);

// ===== Static Asset Routes =====

// Serve CSS
app.get("/style.css", (c) =>
  c.text(STYLE_CSS, 200, { "Content-Type": "text/css; charset=utf-8" })
);

// Serve favicon.ico
app.get("/favicon.ico", (c) => {
  const binaryString = atob(FAVICON_ICO_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return c.body(bytes, 200, {
    "Content-Type": "image/x-icon",
    "Cache-Control": "public, max-age=86400"
  });
});

// Serve 180px PNG icon
app.get("/icons/owlHeadA_180.png", (c) =>
  c.body(Uint8Array.from(atob(OWL_ICON_180_BASE64), c => c.charCodeAt(0)), 200, {
    "Content-Type": "image/png"
  })
);

// Serve 32px PNG icon
app.get("/icons/owlHeadA_32.png", (c) =>
  c.body(Uint8Array.from(atob(OWL_ICON_32_BASE64), c => c.charCodeAt(0)), 200, {
    "Content-Type": "image/png"
  })
);

// Serve web manifest
app.get("/site.webmanifest", (c) =>
  c.text(MANIFEST_JSON, 200, { "Content-Type": "application/manifest+json; charset=utf-8" })
);

// Export the app as the Worker
export default app;
