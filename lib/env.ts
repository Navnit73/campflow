import { z } from "zod";

/**
 * Server environment, validated once on first use.
 *
 * Which database is used is decided ONLY by MONGODB_URI (see .env.example / docs/ENVIRONMENTS.md).
 * There is no silent fallback: a throwaway in-memory database is used only when
 * ALLOW_IN_MEMORY_DB=true is set explicitly (automated tests).
 */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    MONGODB_URI: optionalString,
    ALLOW_IN_MEMORY_DB: optionalString,
    JWT_SECRET: optionalString,
    CRON_SECRET: optionalString,
    NEXT_PUBLIC_APP_URL: optionalString,
    RESEND_API_KEY: optionalString,
    RESEND_FROM_EMAIL: optionalString,
    RESEND_TEST_EMAIL: optionalString,
  })
  .superRefine((env, ctx) => {
    const prod = env.NODE_ENV === "production";
    if (!env.MONGODB_URI && env.ALLOW_IN_MEMORY_DB !== "true") {
      ctx.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message: "is not set. Copy .env.example → .env.local and run `npm run db:local`, or point it at your MongoDB/Atlas cluster.",
      });
    }
    if (env.MONGODB_URI && !/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) {
      ctx.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "must start with mongodb:// or mongodb+srv://" });
    }
    if (prod && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
      ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "must be at least 32 characters in production" });
    }
    if (prod && !env.NEXT_PUBLIC_APP_URL) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_APP_URL"], message: "is required in production (used in email links)" });
    }
    if (prod && env.RESEND_API_KEY && !env.RESEND_FROM_EMAIL) {
      ctx.addIssue({ code: "custom", path: ["RESEND_FROM_EMAIL"], message: "is required when RESEND_API_KEY is set in production (verified sender)" });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

export function serverEnv(): ServerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")} ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  return parsed.data;
}

/** Public base URL for links in emails etc. In development falls back to the local dev server. */
export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** "mongodb://user:***@host/db" — safe to log. */
export function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
}
