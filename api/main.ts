import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { env } from "../parse-env.ts";

const app = new Hono();

app.get("/api/welcome", (c) => {
  return c.text("Welcome to Deno + Hono!");
});

if (import.meta.main) {
  switch (env().BUILD_MODE) {
    case "dev": {
      app.use(
        "*",
        cors({
          origin: `http://127.0.0.1:${env().PORT}`,
          credentials: true,
        }),
      );

      break;
    }

    case "prod": {
      app.use("/*", serveStatic({ root: "./public" }));
      app.use("/*", serveStatic({ root: "./dist" }));

      break;
    }

    default: {
      console.error("Unknown BUILD_MODE:", env().BUILD_MODE);
      Deno.exit(1);
    }
  }

  Deno.serve({ hostname: "127.0.0.1", port: env().API_PORT }, app.fetch);
}
