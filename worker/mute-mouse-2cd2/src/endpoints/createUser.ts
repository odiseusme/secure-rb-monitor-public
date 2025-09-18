import { OpenAPIRoute, Query } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

export class CreateUser extends OpenAPIRoute {
  schema = {
    tags: ["User Management"],
    summary: "Create new user account (Admin only)",
    request: {
      headers: z.object({
        "x-admin-key": z.string().describe("Admin API key for authentication"),
      }),
    },
    responses: {
      "200": {
        description: "User created successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              publicId: z.string().describe("Public ID for dashboard access"),
              writeToken: z.string().describe("Write token for data updates"),
              salt: z.string().describe("Salt for key derivation"),
              kdfParams: z.object({
                algorithm: z.string(),
                iterations: z.number(),
                memory: z.number().optional(),
                parallelism: z.number().optional(),
              }),
            }),
          },
        },
      },
      "401": {
        description: "Unauthorized - Invalid admin key",
      },
      "500": {
        description: "Internal server error",
      },
    },
  };

  async handle(c: Context) {
    try {
      // Check admin authentication
      const adminKey = c.req.header("x-admin-key");
      const expectedAdminKey = c.env.ADMIN_API_KEY;
      
      if (!adminKey || !expectedAdminKey || adminKey !== expectedAdminKey) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Generate unique identifiers
      const publicId = this.generateId(32);
      const writeToken = this.generateId(64);
      const salt = this.generateId(32);

      // KDF parameters for PBKDF2-SHA256
      const kdfParams = {
        algorithm: "PBKDF2",
        hash: "SHA256",
        iterations: 100000, // or match your dashboard default
      };

      // Store user metadata in KV
      const userMetadata = {
        publicId,
        writeToken,
        salt,
        kdfParams,
        createdAt: new Date().toISOString(),
        lastUpdate: null,
        revision: 0,
      };

      await c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userMetadata));
      await c.env.USERS_KV.put(`token:${writeToken}`, publicId);

      // Rate limiting metadata
      const rateLimitKey = `rate:${publicId}`;
      await c.env.USERS_KV.put(rateLimitKey, JSON.stringify({
        reads: 0,
        writes: 0,
        lastReset: new Date().toISOString(),
      }), { expirationTtl: 3600 }); // Reset every hour

      return c.json({
        success: true,
        publicId,
        writeToken,
        salt,
        kdfParams,
      });

    } catch (error) {
      console.error("Error creating user:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  private generateId(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomArray = new Uint8Array(length);
    crypto.getRandomValues(randomArray);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length];
    }
    
    return result;
  }
}
