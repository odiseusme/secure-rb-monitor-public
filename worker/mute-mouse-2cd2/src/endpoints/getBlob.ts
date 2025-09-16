import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

export class GetBlob extends OpenAPIRoute {
  schema = {
    tags: ["Data Management"],
    summary: "Retrieve encrypted data blob",
    request: {
      params: z.object({
        publicId: z.string().describe("Public ID of the user"),
      }),
    },
    responses: {
      "200": {
        description: "Encrypted data blob retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                nonce: z.string(),
                ciphertext: z.string(),
                tag: z.string(),
                rev: z.number(),
                schemaVersion: z.number(),
                issuedAt: z.string(),
                prevHash: z.string().optional(),
                updatedAt: z.string(),
              }).optional(),
              userInfo: z.object({
                publicId: z.string(),
                salt: z.string(),
                kdfParams: z.object({
                  algorithm: z.string(),
                  iterations: z.number(),
                  memory: z.number(),
                  parallelism: z.number(),
                }),
              }),
            }),
          },
        },
      },
      "404": {
        description: "User or data not found",
      },
      "429": {
        description: "Too many requests",
      },
    },
  };

  async handle(c: Context) {
    try {
      const { publicId } = c.req.param();

      if (!publicId || publicId.length !== 32) {
        return c.json({ error: "Invalid public ID" }, 400);
      }

      // Rate limiting for reads
      const rateLimitKey = `rate:${publicId}`;
      const rateLimitData = await c.env.USERS_KV.get(rateLimitKey);
      
      if (rateLimitData) {
        const rateLimit = JSON.parse(rateLimitData);
        const now = new Date();
        const lastReset = new Date(rateLimit.lastReset);
        const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceReset < 1 && rateLimit.reads >= 30) { // 30 reads per hour limit
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
          rateLimit.reads = 0;
          rateLimit.lastReset = now.toISOString();
        }
        
        rateLimit.reads++;
        await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
      }

      // Get user metadata
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        return c.json({ error: "User not found" }, 404);
      }

      const userData = JSON.parse(userDataRaw);

      // Track user activity for spam detection
      userData.totalRequests = (userData.totalRequests || 0) + 1;
      userData.lastActivity = new Date().toISOString();

      // Update user activity tracking
      await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData));

      // Get encrypted blob (if exists)
      const blobKey = `blob:${publicId}`;
      const blobDataRaw = await c.env.USERS_KV.get(blobKey);
      
      let blobData = null;
      if (blobDataRaw) {
        blobData = JSON.parse(blobDataRaw);
      }

      // Return user info and encrypted blob
      const response = {
        success: true,
        data: blobData,
        userInfo: {
          publicId: userData.publicId,
          salt: userData.salt,
          kdfParams: userData.kdfParams,
        },
      };

      return c.json(response);

    } catch (error) {
      console.error("Error retrieving blob:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
