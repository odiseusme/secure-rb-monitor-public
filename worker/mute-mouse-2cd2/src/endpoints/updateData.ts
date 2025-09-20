import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

export class UpdateData extends OpenAPIRoute {
  schema = {
    tags: ["Data Management"],
    summary: "Update encrypted data blob (AES-GCM; tag embedded in ciphertext)",
    request: {
      headers: z.object({
        "authorization": z.string().describe("Bearer token for authentication"),
        "content-type": z.literal("application/json"),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              // NOTE: AES-GCM format used by the client:
              // - nonce: base64 (12 bytes)
              // - ciphertext: base64 (ciphertext || authTag)
              nonce: z.string().describe("GCM nonce (base64, 12 bytes)"),
              ciphertext: z.string().describe("GCM ciphertext with auth tag appended (base64)"),
              version: z.number().describe("Data version for concurrency control"),
              issuedAt: z.string().describe("ISO timestamp when data was created"),
              prevHash: z.string().optional().describe("Hash of previous version"),
              schemaVersion: z.number().default(1).describe("Data schema version"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Data updated successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              revision: z.number(),
            }),
          },
        },
      },
      "401": { description: "Unauthorized - Invalid write token" },
      "409": { description: "Conflict - Stale revision" },
      "429": { description: "Too many requests" },
    },
  };

  async handle(c: Context) {
    try {
      // --- Auth: Bearer write token -> map to publicId
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401);
      }
      const writeToken = authHeader.substring(7);
      const publicId = await c.env.USERS_KV.get(`token:${writeToken}`);
      if (!publicId) {
        return c.json({ error: "Invalid write token" }, 401);
      }

      // --- Rate limit writes (simple local KV-based)
      const rateLimitKey = `rate:${publicId}`;
      const rateLimitData = await c.env.USERS_KV.get(rateLimitKey);
      if (rateLimitData) {
        const rate = JSON.parse(rateLimitData);
        const now = new Date();
        const lastReset = new Date(rate.lastReset);
        const hours = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

        if (hours < 1 && rate.writes >= 100) {
          // bump violation count on user record
          const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
          if (userDataRaw) {
            const user = JSON.parse(userDataRaw);
            user.rateLimitViolations = (user.rateLimitViolations || 0) + 1;
            await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(user));
          }
          return c.json({ error: "Rate limit exceeded" }, 429);
        }
        if (hours >= 1) {
          rate.writes = 0;
          rate.lastReset = now.toISOString();
        }
        rate.writes++;
        await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rate), { expirationTtl: 3600 });
      }

      // --- Load user metadata
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        return c.json({ error: "User not found" }, 401);
      }
      const userData = JSON.parse(userDataRaw);

      // --- Parse request body (NO separate 'tag' expected anymore)
      const body = await c.req.json();
      const {
        nonce,
        ciphertext,
        version,
        issuedAt,
        prevHash,
        schemaVersion = 1,
      } = body || {};

      if (!nonce || !ciphertext || typeof version !== "number" || !issuedAt) {
        return c.json({ error: "Invalid payload structure" }, 400);
      }

// --- Check revision monotonicity (WITH DEBUG)
      const currentRevision = userData.revision || 0;
      console.log(`[DEBUG] Version check: incoming=${version}, stored=${currentRevision}, userData:`, JSON.stringify(userData, null, 2));
      
      if (version <= currentRevision) {
        console.log(`[DEBUG] REJECTING: ${version} <= ${currentRevision}`);
        return c.json({ error: "Stale revision" }, 409);
      }
      
      console.log(`[DEBUG] ACCEPTING: ${version} > ${currentRevision}`);
      // --- Limit payload size (25MB)
      const approxSize = JSON.stringify(body).length;
      if (approxSize > 25 * 1024 * 1024) {
        return c.json({ error: "Payload too large" }, 413);
      }

      // --- Update user metadata/activity
      userData.revision = version;
      userData.lastUpdate = new Date().toISOString();
      userData.totalRequests = (userData.totalRequests || 0) + 1;
      userData.lastActivity = new Date().toISOString();

      // --- Store encrypted blob (AES-GCM: ciphertext already includes auth tag)
      const blobKey = `blob:${publicId}`;
      const blob = {
        nonce,
        ciphertext,
        rev: version,
        schemaVersion,
        issuedAt,
        prevHash,
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData)),
        c.env.USERS_KV.put(blobKey, JSON.stringify(blob)),
      ]);

      return c.json({ success: true, revision: version });
    } catch (error) {
      console.error("Error updating data:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
