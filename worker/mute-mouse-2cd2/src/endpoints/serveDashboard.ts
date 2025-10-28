import type { Context } from "hono";
import { DASHBOARD_HTML } from "../assets";

import { safeLogError } from "../utils/redact";
export const ServeDashboard = async (c: Context) => {
  try {
    const { publicId } = c.req.param();

    if (!publicId || publicId.length !== 32) {
      return c.html(getErrorPage("Invalid dashboard URL"), 400);
    }

    const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
    if (!userDataRaw) {
      return c.html(getErrorPage("Dashboard not found"), 404);
    }

    // Replace {{PUBLIC_ID}} in the HTML template
    const html = DASHBOARD_HTML.replace("{{PUBLIC_ID}}", publicId);

    return c.html(html, 200, {
      "Content-Type": "text/html; charset=utf-8",
    });
  } catch (err) {
    safeLogError(err, { context: "serveDashboard" });
    return c.html(getErrorPage("Internal server error"), 500);
  }
};

// Optional: keep or move this error page template to assets.ts
function getErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<title>Dashboard Error</title>
<style>
body { 
  font-family: Arial; 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
  color: white; 
  padding: 50px; 
  text-align: center;
}
.card { 
  background: white; 
  color: black; 
  padding: 30px; 
  border-radius: 15px; 
  display: inline-block;
}
</style>
</head>
<body>
<div class="card">
<h1>Dashboard Error</h1>
<p>${message}</p>
</div>
</body>
</html>`;
}

export default ServeDashboard;
