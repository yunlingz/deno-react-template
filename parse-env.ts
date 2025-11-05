import * as z from "zod";
import * as R from "remeda";

const envSchema = z.object({
  BUILD_MODE: z.enum(["dev", "prod"]),
  OAUTH2_SERVER_BASE_URL: z.url(),
  OAUTH2_CLIENT_ID: z.string().min(1),
  OAUTH2_CLIENT_SECRET: z.string().min(1),
  OAUTH2_CLIENT_BASE_URL: z.url(),
  PORT: z.string()
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0 && val < 65536, {
      message: "PORT must be a valid port number (1-65535)",
    }),
});

export type Env = z.infer<typeof envSchema> & {
  API_PORT: number;
};

export const env = R.once((): Env => {
  try {
    const parsed = envSchema.parse(Deno.env.toObject());

    const API_PORT = ((): number => {
      switch (parsed.BUILD_MODE) {
        case "dev": {
          return Math.min(parsed.PORT + 1, 65535);
        }

        case "prod": {
          return parsed.PORT;
        }

        default: {
          console.error("Unknown BUILD_MODE:", parsed.BUILD_MODE);
          Deno.exit(1);
        }
      }
    })();

    const env: Env = {
      ...parsed,
      API_PORT,
    };

    console.log("Loaded environment variables:", env);
    return env;
  } catch (error) {
    console.error("Error parsing environment variables:", error);
    throw error;
  }
});
