import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

import { safeLogError } from "../utils/redact";
export class DeleteUser extends OpenAPIRoute {
  schema = {
    tags: ["User Management"],
    summary: "Delete user account and all data (Admin only)",
    request: {
      headers: z.object({
        "x-admin-key": z.string().describe("Admin API key for authentication"),
      }),
      params: z.object({
        publicId: z.string().describe("Public ID of the user to delete"),
      }),
    },
    responses: {
      "200": {
        description: "User deleted successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              deleted: z.object({
                publicId: z.string(),
                writeToken: z.string(),
                dataBlob: z.boolean(),
                rateLimit: z.boolean(),
              }),
            }),
          },
        },
      },
      "401": {
        description: "Unauthorized - Invalid admin key",
      },
      "404": {
        description: "User not found",
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

      const { publicId } = c.req.param();

      if (!publicId || publicId.length !== 32) {
        return c.json({ error: "Invalid public ID" }, 400);
      }

      // Get user data to find writeToken
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        return c.json({ error: "User not found" }, 404);
      }

      const userData = JSON.parse(userDataRaw);
      const writeToken = userData.writeToken;

      // Delete all user-related keys
      const deletionPromises = [
        c.env.USERS_KV.delete(`user:${publicId}`),
        c.env.USERS_KV.delete(`token:${writeToken}`),
        c.env.USERS_KV.delete(`blob:${publicId}`),
        c.env.USERS_KV.delete(`rate:${publicId}`),
      ];

      // Execute all deletions
      await Promise.all(deletionPromises);

      return c.json({
        success: true,
        deleted: {
          publicId: publicId,
          writeToken: writeToken,
          dataBlob: true,
          rateLimit: true,
        },
      });

    } catch (error) {
      safeLogError(error, { context: "Error deleting user:" });
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
