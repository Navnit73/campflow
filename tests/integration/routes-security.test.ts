import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant } from "../helpers/fixtures";
import { User } from "@/models/User";
import { signAuthToken } from "@/lib/auth/jwt";
import { invalidateUserSession } from "@/lib/auth/session";
import { __resetRateLimits } from "@/lib/utils/rate-limit";
import * as sitesRoute from "@/app/api/sites/route";
import * as siteByIdRoute from "@/app/api/sites/[id]/route";
import * as paymentsRoute from "@/app/api/payments/route";
import * as cronRoute from "@/app/api/cron/exports/route";
import * as broadcastsRoute from "@/app/api/communications/broadcasts/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as confirmationRoute from "@/app/api/public/book/confirmation/[code]/route";

setupTestDatabase();
beforeEach(() => __resetRateLimits());

async function userToken(t: any, role: "owner" | "manager" | "staff", isActive = true) {
  const u = await User.create({ organizationId: t.org._id, name: role, email: `${role}-${Date.now()}-${Math.random()}@x.com`, passwordHash: "x", role, isActive });
  invalidateUserSession(u._id.toString());
  return {
    user: u,
    token: signAuthToken({ userId: u._id.toString(), organizationId: t.orgId, propertyId: t.propertyId, email: u.email, role, name: role }),
  };
}

const req = (url: string, init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers || {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

const siteBody = (t: any) => ({ siteNumber: `B${Math.floor(Math.random() * 1e6)}`, siteTypeId: t.siteType._id.toString() });

describe("RBAC (audit H8)", () => {
  it("staff can read sites but not create them; managers can", async () => {
    const t = await seedTenant();
    const staff = await userToken(t, "staff");
    const manager = await userToken(t, "manager");
    expect((await sitesRoute.GET(req("/api/sites", { token: staff.token }))).status).toBe(200);
    expect((await sitesRoute.POST(req("/api/sites", { method: "POST", token: staff.token, body: siteBody(t) }))).status).toBe(403);
    expect((await sitesRoute.POST(req("/api/sites", { method: "POST", token: manager.token, body: siteBody(t) }))).status).toBe(201);
  });

  it("only owners can send broadcasts", async () => {
    const t = await seedTenant();
    const manager = await userToken(t, "manager");
    const res = await broadcastsRoute.POST(req("/api/communications/broadcasts", { method: "POST", token: manager.token, body: {} }));
    expect(res.status).toBe(403);
  });

  it("staff can take payments but not issue refunds", async () => {
    const t = await seedTenant();
    const staff = await userToken(t, "staff");
    const res = await paymentsRoute.POST(
      req("/api/payments", { method: "POST", token: staff.token, body: { reservationId: t.site._id.toString(), amount: 5, type: "refund", method: "cash" } })
    );
    expect(res.status).toBe(403);
  });
});

describe("session revocation (audit H9)", () => {
  it("a deactivated user's still-valid JWT is rejected", async () => {
    const t = await seedTenant();
    const owner = await userToken(t, "owner");
    expect((await sitesRoute.GET(req("/api/sites", { token: owner.token }))).status).toBe(200);
    await User.updateOne({ _id: owner.user._id }, { $set: { isActive: false } });
    invalidateUserSession(owner.user._id.toString());
    expect((await sitesRoute.GET(req("/api/sites", { token: owner.token }))).status).toBe(401);
  });

  it("role comes from the database, not the token (demotion takes effect)", async () => {
    const t = await seedTenant();
    const owner = await userToken(t, "owner");
    await User.updateOne({ _id: owner.user._id }, { $set: { role: "staff" } });
    invalidateUserSession(owner.user._id.toString());
    expect((await sitesRoute.POST(req("/api/sites", { method: "POST", token: owner.token, body: siteBody(t) }))).status).toBe(403);
  });
});

describe("cron endpoint (audit C6)", () => {
  it("rejects missing/wrong secret and accepts the right one", async () => {
    expect((await cronRoute.GET(req("/api/cron/exports"))).status).toBe(401);
    expect((await cronRoute.GET(req("/api/cron/exports", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const ok = await cronRoute.GET(req("/api/cron/exports", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(ok.status).toBe(200);
  });
});

describe("error mapping (audit H10)", () => {
  it("invalid ObjectId → 400, not a 500 with internals", async () => {
    const t = await seedTenant();
    const owner = await userToken(t, "owner");
    const res = await siteByIdRoute.GET(req("/api/sites/not-an-id", { token: owner.token }), { params: Promise.resolve({ id: "not-an-id" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_ID");
  });

  it("malformed JSON → 400", async () => {
    const t = await seedTenant();
    const owner = await userToken(t, "owner");
    const bad = new NextRequest("http://localhost/api/sites", { method: "POST", headers: { authorization: `Bearer ${owner.token}` }, body: "{nope" });
    expect((await sitesRoute.POST(bad)).status).toBe(400);
  });
});

describe("auth hardening", () => {
  it("login does not return the JWT in the JSON body (cookie only)", async () => {
    const t = await seedTenant();
    const { hashPassword } = await import("@/lib/auth/password");
    await User.create({ organizationId: t.org._id, name: "O", email: "owner@x.com", passwordHash: await hashPassword("correct-horse"), role: "owner" });
    const res = await loginRoute.POST(req("/api/auth/login", { method: "POST", body: { email: "owner@x.com", password: "correct-horse" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.token).toBeUndefined();
    expect(res.cookies.get("rv_session_token")?.value).toBeTruthy();
  });

  it("login is rate limited", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await loginRoute.POST(req("/api/auth/login", { method: "POST", body: { email: "nobody@x.com", password: "whatever1" } }))).status;
    }
    expect(last).toBe(429);
  });

  it("public confirmation lookup is rate limited", async () => {
    let last = 0;
    for (let i = 0; i < 35; i++) {
      last = (await confirmationRoute.GET(req("/api/public/book/confirmation/RV-AAAAAAAA"), { params: Promise.resolve({ code: "RV-AAAAAAAA" }) })).status;
    }
    expect(last).toBe(429);
  });

  it("JWT signing refuses to run in production without a strong secret (audit C4)", async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = { secret: env.JWT_SECRET, nodeEnv: env.NODE_ENV };
    try {
      delete env.JWT_SECRET;
      env.NODE_ENV = "production";
      expect(() => signAuthToken({ userId: "1", organizationId: "1", propertyId: "1", email: "a", role: "owner", name: "a" })).toThrow(/JWT_SECRET/);
    } finally {
      env.JWT_SECRET = prev.secret;
      env.NODE_ENV = prev.nodeEnv;
    }
  });
});
