import type { Context } from "hono";
import { DASHBOARD_HTML } from "../assets";
import { safeLogError } from "../utils/redact";

// Phase 1 CSP helpers (nonce-based)
import { generateNonce, buildCsp, applyCsp } from "../csp";

export const ServeDashboard = async (c: Context) => {
  // === Phase 1: Nonce-based CSP per request (build first so we can use on any return path) ===
  const nonce = generateNonce();
  const reqUrl = new URL(c.req.url);
  const origin = reqUrl.origin;

  // Treat localhost/127.* as "local dev"
  const host = reqUrl.hostname;
  const isLocal =
    host === "localhost" ||
    host.startsWith("127.");

  const csp = buildCsp(
    {
      connectOrigins: [origin],  // dashboard fetches same-origin /api/*
      allowInlineStyles: true,   // Phase 1 keeps inline styles
      extraImgSrc: [],           // defaults: self data: blob:
    },
    nonce
  );

  try {
    const { publicId } = c.req.param();

    // Validate publicId early
    if (!publicId || publicId.length !== 32) {
      const res = c.html(getErrorPage("Invalid dashboard URL"), 400);
      applyCsp(res, csp);
      return res;
    }

    // DEV BYPASS LOGIC:
    //  - If BYPASS_KV_DASHBOARD="true" OR we're running on localhost/127.*, skip KV check.
    const bypassFlag = (c.env as any)?.BYPASS_KV_DASHBOARD === "true";
    const bypass = bypassFlag || isLocal;

    if (!bypass) {
      // Production (or non-local dev without flag): verify the dashboard exists (fail closed).
      const userDataRaw = await c.env.USERS_KV.get(`user:${publicId}`);
      if (!userDataRaw) {
        const res = c.html(getErrorPage("Dashboard not found"), 404);
        applyCsp(res, csp);
        return res;
      }
    }

    // Inject PUBLIC_ID and the nonce attribute for the inline <script>
    const html = DASHBOARD_HTML
      .replace("{{PUBLIC_ID}}", publicId)
      // Add nonce to the first "<script>" tag (your template has a single main inline block)
      .replace("<script>", `<script nonce="${nonce}">`);

    // Create response and apply CSP header
    const res = c.html(html, 200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    applyCsp(res, csp);
    return res;

  } catch (err) {
    safeLogError(err, { context: "serveDashboard" });
    const res = c.html(getErrorPage("Internal server error"), 500);
    applyCsp(res, csp);
    return res;
  }
};

// Simple error page (unchanged)
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
