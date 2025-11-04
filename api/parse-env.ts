import * as z from "zod";
import * as R from "remeda";

const envSchema = z.object({
  BUILD_MODE: z.enum(["dev", "prod"]),
});

export type Env = z.infer<typeof envSchema>;

export const env = R.once((): Env => {
  try {
    const parsed = envSchema.parse(Deno.env.toObject());
    return parsed;
  } catch (error) {
    console.error("Error parsing environment variables:", error);
    throw error;
  }
});
