import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

import { safeLogError } from "../utils/redact";
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
        description: "Too many requests (currently disabled)",
      },
    },
  };

  async handle(c: Context) {
    try {
      const { publicId } = c.req.param();

      if (!publicId || publicId.length !== 32) {
        return c.json({ error: "Invalid public ID" }, 400);
      }

      // Get user metadata
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        return c.json({ error: "User not found" }, 404);
      }
      const userData = JSON.parse(userDataRaw);

      /* RATE LIMITING DISABLED FOR PUBLIC RELEASE v1.0
       * Can be re-enabled post-release if needed
       * See complete_project_docs.md for instructions
       * 
      // Rate limiting for reads
      const rateLimitKey = `rate:${publicId}`;
      const rateLimitData = await c.env.USERS_KV.get(rateLimitKey);

      let rateLimit;
      if (rateLimitData) {
        rateLimit = JSON.parse(rateLimitData);
      } else {
        rateLimit = {
          reads: 0,
          lastReset: new Date().toISOString()
        };
      }

      const now = new Date();
      const lastReset = new Date(rateLimit.lastReset);
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

      // Reset counters if more than an hour has passed
      if (hoursSinceReset >= 1) {
        rateLimit.reads = 0;
        rateLimit.lastReset = now.toISOString();
        await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
      }

      // Check if rate limit exceeded
      if (rateLimit.reads >= 30) {
        userData.rateLimitViolations = (userData.rateLimitViolations || 0) + 1;
        await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData));
        return c.json({ error: "Rate limit exceeded" }, 429);
      }

      // Increment counter after checking limit
      rateLimit.reads++;
      await c.env.USERS_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
      */

      // Track user activity (keep this for admin stats)
      userData.totalRequests = (userData.totalRequests || 0) + 1;
      userData.lastActivity = new Date().toISOString();
      await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userData));

      // Get encrypted blob
      const blobKey = `blob:${publicId}`;
      const blobDataRaw = await c.env.USERS_KV.get(blobKey);
      
      let blobData = null;
      if (blobDataRaw) {
        blobData = JSON.parse(blobDataRaw);
      }

      return c.json({
        success: true,
        data: blobData,
        userInfo: {
          publicId: userData.publicId,
          salt: userData.salt,
          kdfParams: userData.kdfParams,
        },
      });

    } catch (error) {
      safeLogError(error, { context: "Error retrieving blob:" });
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
