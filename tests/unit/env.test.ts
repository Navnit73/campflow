import { describe, it, expect, afterEach } from "vitest";
import { serverEnv, redactMongoUri, appUrl } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});
const set = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe("environment validation", () => {
  it("fails loudly when MONGODB_URI is missing (no silent in-memory database)", () => {
    set({ MONGODB_URI: undefined, ALLOW_IN_MEMORY_DB: undefined });
    expect(() => serverEnv()).toThrow(/MONGODB_URI is not set/);
  });

  it("allows the in-memory database only by explicit opt-in", () => {
    set({ MONGODB_URI: undefined, ALLOW_IN_MEMORY_DB: "true" });
    expect(serverEnv().MONGODB_URI).toBeUndefined();
  });

  it("rejects malformed URIs", () => {
    set({ MONGODB_URI: "postgres://x" });
    expect(() => serverEnv()).toThrow(/mongodb:\/\//);
  });

  it("enforces production requirements", () => {
    set({ NODE_ENV: "production", MONGODB_URI: "mongodb+srv://u:p@c.mongodb.net/db", JWT_SECRET: "short", NEXT_PUBLIC_APP_URL: undefined });
    const msg = (() => {
      try {
        serverEnv();
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    })();
    expect(msg).toMatch(/JWT_SECRET must be at least 32/);
    expect(msg).toMatch(/NEXT_PUBLIC_APP_URL is required/);
  });

  it("redacts credentials and normalises the app URL", () => {
    expect(redactMongoUri("mongodb+srv://admin:s3cret@cluster.mongodb.net/db")).toBe("mongodb+srv://admin:***@cluster.mongodb.net/db");
    set({ NEXT_PUBLIC_APP_URL: "https://app.example.com/" });
    expect(appUrl()).toBe("https://app.example.com");
  });
});
