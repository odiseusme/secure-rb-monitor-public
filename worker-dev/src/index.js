export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Simple health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Minimal /api/update endpoint
    if (url.pathname === "/api/update" && request.method === "POST") {
      const auth = request.headers.get("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

      // Require a token (for local dev we just check it's non-empty)
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing Authorization Bearer token" }), {
          status: 401,
          headers: { "content-type": "application/json" }
        });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Log a tiny summary to your terminal
      const keys = Object.keys(body);
      console.log("[/api/update] keys:", keys);
      console.log("[/api/update] nonce.len:", (body.nonce || "").length, "ciphertext.len:", (body.ciphertext || "").length);

      // Echo back a small OK response
      return new Response(JSON.stringify({ ok: true, received: { keys, issuedAt: body.issuedAt, schemaVersion: body.schemaVersion } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
