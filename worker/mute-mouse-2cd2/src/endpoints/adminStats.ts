import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

import { safeLogError } from "../utils/redact";
export class AdminStats extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "Get user analytics and activity stats (Admin only)",
    request: {
      headers: z.object({
        "x-admin-key": z.string().describe("Admin API key for authentication"),
      }),
      query: z.object({
        includeInactive: z.string().optional().describe("Include users inactive >30 days (true/false)"),
        suspiciousOnly: z.string().optional().describe("Show only suspicious users (true/false)"),
      }),
    },
    responses: {
      "200": {
        description: "User analytics retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              summary: z.object({
                totalUsers: z.number(),
                activeUsers: z.number(),
                inactiveUsers: z.number(),
                suspiciousUsers: z.number(),
                totalInvitesSent: z.number(),
                unusedInvites: z.number(),
              }),
              users: z.array(z.object({
                publicId: z.string(),
                inviteCode: z.string(),
                registeredAt: z.string(),
                lastActivity: z.string(),
                daysSinceActivity: z.number(),
                totalRequests: z.number(),
                rateLimitViolations: z.number(),
                avgRequestsPerDay: z.number(),
                suspiciousActivity: z.boolean(),
                suspiciousReasons: z.array(z.string()),
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

      const includeInactive = c.req.query('includeInactive') === 'true';
      const suspiciousOnly = c.req.query('suspiciousOnly') === 'true';

      // Get all users and invitations
      const [usersData, invitesData] = await Promise.all([
        this.getAllUsers(c.env.USERS_KV),
        this.getAllInvites(c.env.USERS_KV),
      ]);

      const now = new Date();
      const users = [];
      let activeCount = 0;
      let suspiciousCount = 0;

      for (const userData of usersData) {
        const lastActivity = new Date(userData.lastActivity || userData.createdAt);
        const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceRegistration = Math.floor((now.getTime() - new Date(userData.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        const avgRequestsPerDay = daysSinceRegistration > 0 ? userData.totalRequests / daysSinceRegistration : 0;
        const isActive = daysSinceActivity <= 30;
        
        if (isActive) activeCount++;

        // Spam/Suspicious activity detection
        const suspiciousReasons = [];
        let isSuspicious = false;

        if (userData.rateLimitViolations > 10) {
          suspiciousReasons.push("Excessive rate limit violations");
          isSuspicious = true;
        }

        if (avgRequestsPerDay > 200) {
          suspiciousReasons.push("Unusually high request rate");
          isSuspicious = true;
        }

        if (userData.totalRequests > 1000 && daysSinceActivity > 7) {
          suspiciousReasons.push("High activity then sudden stop");
          isSuspicious = true;
        }

        if (userData.totalRequests === 0 && daysSinceRegistration > 7) {
          suspiciousReasons.push("Registered but never used");
          isSuspicious = true;
        }

        if (isSuspicious) suspiciousCount++;

        const userStats = {
          publicId: userData.publicId,
          inviteCode: userData.inviteCode || "UNKNOWN",
          registeredAt: userData.createdAt,
          lastActivity: userData.lastActivity || userData.createdAt,
          daysSinceActivity,
          totalRequests: userData.totalRequests || 0,
          rateLimitViolations: userData.rateLimitViolations || 0,
          avgRequestsPerDay: Math.round(avgRequestsPerDay * 10) / 10,
          suspiciousActivity: isSuspicious,
          suspiciousReasons,
        };

        // Apply filters
        if (suspiciousOnly && !isSuspicious) continue;
        if (!includeInactive && !isActive) continue;

        users.push(userStats);
      }

      const summary = {
        totalUsers: usersData.length,
        activeUsers: activeCount,
        inactiveUsers: usersData.length - activeCount,
        suspiciousUsers: suspiciousCount,
        totalInvitesSent: invitesData.length,
        unusedInvites: invitesData.filter(i => !i.used).length,
      };

      return c.json({
        success: true,
        summary,
        users: users.sort((a, b) => b.totalRequests - a.totalRequests), // Sort by activity
      });

    } catch (error) {
      safeLogError(error, { context: "Error getting admin stats:" });
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  private async getAllUsers(kv: KVNamespace): Promise<any[]> {
    const users = [];
    let cursor: string | undefined;

    do {
      const result = await kv.list({ prefix: "user:", cursor });
      
      for (const key of result.keys) {
        try {
          const userData = await kv.get(key.name);
          if (userData) {
            users.push(JSON.parse(userData));
          }
        } catch (e) {
          safeLogError(e, { context: "Error parsing user data", key: key.name });
        }
      }
      
      cursor = result.cursor;
    } while (cursor);

    return users;
  }

  private async getAllInvites(kv: KVNamespace): Promise<any[]> {
    const invites = [];
    let cursor: string | undefined;

    do {
      const result = await kv.list({ prefix: "invite:", cursor });
      
      for (const key of result.keys) {
        try {
          const inviteData = await kv.get(key.name);
          if (inviteData) {
            invites.push(JSON.parse(inviteData));
          }
        } catch (e) {
          safeLogError(e, { context: "Error parsing invite data", key: key.name });
        }
      }
      
      cursor = result.cursor;
    } while (cursor);

    return invites;
  }
}
