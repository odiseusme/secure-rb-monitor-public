import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { safeLogError } from "../utils/redact";

export class RegisterUser extends OpenAPIRoute {
  schema = {
    tags: ["User Management"],
    summary: "Register new user with invitation code",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              inviteCode: z.string().describe("Valid invitation code"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "User registered successfully",
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
                memory: z.number(),
                parallelism: z.number(),
              }),
              dashboardUrl: z.string().describe("URL for dashboard access"),
            }),
          },
        },
      },
      "400": {
        description: "Invalid or expired invitation code",
      },
      "409": {
        description: "Invitation code already used",
      },
    },
  };

  async handle(c: Context) {
    try {
      const { inviteCode } = await c.req.json();
      
      if (!inviteCode || typeof inviteCode !== 'string') {
        return c.json({ error: "Invalid invitation code format" }, 400);
      }

      // Validate invitation code
      const inviteDataRaw = await c.env.USERS_KV.get(`invite:${inviteCode}`);
      if (!inviteDataRaw) {
        return c.json({ error: "Invalid invitation code" }, 400);
      }

      const inviteData = JSON.parse(inviteDataRaw);
      
      // Check if already used
      if (inviteData.used) {
        return c.json({ error: "Invitation code already used" }, 409);
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(inviteData.expiresAt);
      if (now > expiresAt) {
        return c.json({ error: "Invitation code has expired" }, 400);
      }

      // Generate user credentials (same as original CreateUser)
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
        inviteCode: inviteCode,
        createdAt: new Date().toISOString(),
        lastUpdate: null,
        lastActivity: new Date().toISOString(),
        revision: 0,
        totalRequests: 0,
        rateLimitViolations: 0,
      };

      // Mark invitation as used
      inviteData.used = true;
      inviteData.usedAt = new Date().toISOString();
      inviteData.usedBy = publicId;
      
      // Store everything atomically
      await Promise.all([
        c.env.USERS_KV.put(`user:${publicId}`, JSON.stringify(userMetadata)),
        c.env.USERS_KV.put(`token:${writeToken}`, publicId),
        c.env.USERS_KV.put(`invite:${inviteCode}`, JSON.stringify(inviteData)),
      ]);

      // Initialize rate limiting metadata
      const rateLimitKey = `rate:${publicId}`;
      await c.env.USERS_KV.put(rateLimitKey, JSON.stringify({
        reads: 0,
        writes: 0,
        lastReset: new Date().toISOString(),
      }), { expirationTtl: 3600 });
      
      // Get the Worker's URL for dashboard link
      const workerUrl = new URL(c.req.url).origin;
      const dashboardUrl = `${workerUrl}/d/${publicId}`;
      
      return c.json({
        success: true,
        publicId,
        writeToken,
        salt,
        kdfParams,
        dashboardUrl,
      });

    } catch (error) {
      safeLogError(error, { context: "registerUser" });
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
