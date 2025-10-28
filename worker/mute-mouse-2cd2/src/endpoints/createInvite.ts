import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

import { safeLogError } from "../utils/redact";
export class CreateInvite extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "Generate invitation codes (Admin only)",
    request: {
      headers: z.object({
        "x-admin-key": z.string().describe("Admin API key for authentication"),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              count: z.number().min(1).max(100).default(1).describe("Number of invitation codes to generate"),
              expiresInDays: z.number().min(1).max(365).default(30).describe("Days until invitation expires"),
              note: z.string().optional().describe("Optional note about this batch of invitations"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Invitation codes generated successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              invitations: z.array(z.object({
                code: z.string(),
                expiresAt: z.string(),
                note: z.string().optional(),
              })),
            }),
          },
        },
      },
      "401": {
        description: "Unauthorized - Invalid admin key",
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

      const { count = 1, expiresInDays = 30, note } = await c.req.json();

      const invitations = [];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      for (let i = 0; i < count; i++) {
        const inviteCode = this.generateInviteCode();
        
        // Store invitation in KV
        const inviteData = {
          code: inviteCode,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          used: false,
          usedAt: null,
          usedBy: null,
          note: note || null,
        };

        await c.env.USERS_KV.put(`invite:${inviteCode}`, JSON.stringify(inviteData));

        invitations.push({
          code: inviteCode,
          expiresAt: expiresAt.toISOString(),
          note: note || undefined,
        });
      }

      return c.json({
        success: true,
        invitations,
      });

    } catch (error) {
      safeLogError(error, { context: "Error creating invitations:" });
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  private generateInviteCode(): string {
    // Generate readable invitation codes like: INVITE-ABC123-XYZ789
    const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // No confusing chars (0,O,I,1)
    let code = "INVITE-";
    
    // First segment
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    code += "-";
    
    // Second segment  
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return code;
  }
}
