import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";

const app = new Hono();
const PORT = 5000;

app.use("*", cors());

app.get("/api/welcome", (c) => {
  return c.text("Welcome to Deno + Hono!");
});

app.use("/*", serveStatic({ root: "./public" }));
app.use("/*", serveStatic({ root: "./dist" }));

if (import.meta.main) {
  Deno.serve({ hostname: "127.0.0.1", port: PORT }, app.fetch);
}
