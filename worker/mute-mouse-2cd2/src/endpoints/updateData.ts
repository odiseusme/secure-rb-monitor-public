import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

export class UpdateData extends OpenAPIRoute {
  schema = {
    tags: ["Data Management"],
    summary: "Update encrypted data blob",
    request: {
      headers: z.object({
        "authorization": z.string().describe("Bearer token for authentication"),
        "content-type": z.literal("application/json"),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              nonce: z.string().describe("Encryption nonce"),
              ciphertext: z.string().describe("Encrypted data blob"),
              tag: z.string().describe("Authentication tag"),
              version: z.number().describe("Data version for concurrency control"),
              issuedAt: z.string().describe("Timestamp when data was created"),
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
      "401": {
        description: "Unauthorized - Invalid write token",
      },
      "409": {
        description: "Conflict - Stale revision",
      },
      "429": {
        description: "Too many requests",
      },
    },
  };

  async handle(c: Context) {
    try {
      // Extract and validate write token
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401);
      }

      const writeToken = authHeader.substring(7); // Remove "Bearer "
      const publicId = await c.env.USERS_KV.get(`token:${writeToken}`);
      
      if (!publicId) {
        return c.json({ error: "Invalid write token" }, 401);
      }

      // Rate limiting check
      const rateLimitKey = `rate:${publicId}`;
      const rateLimitData = await c.env.USERS_KV.get(rateLimitKey);
      
      if (rateLimitData) {
        const rateLimit = JSON.parse(rateLimitData);
        const now = new Date();
        const lastReset = new Date(rateLimit.lastReset);
        const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceReset < 1 && rateLimit.writes >= 5) { // 5 writes per hour limit
          // Track rate limit violation before returning error
          const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
          if (userDataRaw) {
            const userData = JSON.parse(userDataRaw);
            userData.rateLimitViolations = (userData.rateLimitViolations || 0) + 1;
            await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData));
          }
          return c.json({ error: "Rate limit exceeded" }, 429);
        }
        
        // Reset counters if more than an hour has passed
        if (hoursSinceReset >= 1) {
          rateLimit.writes = 0;
          rateLimit.lastReset = now.toISOString();
        }
        
        rateLimit.writes++;
        await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
      }

      // Get current user metadata
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        return c.json({ error: "User not found" }, 401);
      }

      const userData = JSON.parse(userDataRaw);

      // Track user activity for spam detection
      userData.totalRequests = (userData.totalRequests || 0) + 1;
      userData.lastActivity = new Date().toISOString();

      const requestBody = await c.req.json();

      // Validate payload structure
      const { nonce, ciphertext, tag, version, issuedAt, prevHash, schemaVersion = 1 } = requestBody;

      if (!nonce || !ciphertext || !tag || typeof version !== 'number' || !issuedAt) {
        return c.json({ error: "Invalid payload structure" }, 400);
      }

      // Check for replay attacks and version conflicts
      if (version <= userData.revision) {
        return c.json({ error: "Stale revision" }, 409);
      }

      // Calculate blob size (approximate)
      const blobSize = JSON.stringify(requestBody).length;
      if (blobSize > 25 * 1024 * 1024) { // 25MB limit
        return c.json({ error: "Payload too large" }, 413);
      }

      // Update user metadata
      userData.revision = version;
      userData.lastUpdate = new Date().toISOString();
      
      // Store encrypted blob
      const blobKey = `blob:${publicId}`;
      const blobData = {
        nonce,
        ciphertext,
        tag,
        rev: version,
        schemaVersion,
        issuedAt,
        prevHash,
        updatedAt: new Date().toISOString(),
      };

      // Atomic updates
      await Promise.all([
        c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData)),
        c.env.USERS_KV.put(blobKey, JSON.stringify(blobData)),
      ]);

      return c.json({
        success: true,
        revision: version,
      });

    } catch (error) {
      console.error("Error updating data:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
