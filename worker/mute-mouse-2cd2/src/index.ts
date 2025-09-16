import { fromHono } from "chanfana";
import { Hono } from "hono";
import { CreateUser } from "./endpoints/createUser";
import { UpdateData } from "./endpoints/updateData";
import { GetBlob } from "./endpoints/getBlob";
import { DeleteUser } from "./endpoints/deleteUser";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints for secure monitoring
openapi.post("/api/create-user", CreateUser);
openapi.post("/api/update", UpdateData);
openapi.get("/api/blob/:publicId", GetBlob);
openapi.delete("/api/user/:publicId", DeleteUser);

// Health check endpoint
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Export the Hono app
export default app;
