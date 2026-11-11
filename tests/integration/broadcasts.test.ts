import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { CommunicationService } from "@/services/communication.service";
import { ReservationService } from "@/services/reservation.service";
import { Broadcast } from "@/models/Broadcast";
import { addDaysStr, zonedDateKey } from "@/lib/utils/date";

setupTestDatabase();

const user = { id: "64b000000000000000000001", name: "Owner" };
const msg = { subject: "Pool closed", message: "The pool is closed today.", priority: "general" as const };

async function stay(t: any, email: string, inOffset: number, outOffset: number, status = "confirmed") {
  const today = zonedDateKey(new Date(), "America/Denver");
  return ReservationService.createReservation(t.orgId, t.propertyId, {
    siteId: (inOffset > 2 ? t.site2 : t.site)._id.toString(),
    guest: guestInput(email),
    checkInDate: addDaysStr(today, inOffset),
    checkOutDate: addDaysStr(today, outOffset),
    adults: 2, children: 0, pets: 0, addOns: [], status, source: "admin", specialRequests: "", notes: "",
  } as any);
}

describe("broadcast audiences (audit M12)", () => {
  it("in-house = on site today; excludes future arrivals", async () => {
    const t = await seedTenant();
    await stay(t, "here@x.com", -1, 2);
    await stay(t, "future@x.com", 3, 5);
    const a = await CommunicationService.resolveAudience(t.propertyId, "in_house_campers");
    expect(a.emails).toEqual(["here@x.com"]);
    const up = await CommunicationService.resolveAudience(t.propertyId, "upcoming_arrivals");
    expect(up.emails).toEqual(["future@x.com"]);
  });

  it("audience preview masks emails", async () => {
    const t = await seedTenant();
    await stay(t, "here@x.com", -1, 2);
    const c = await CommunicationService.getAudienceCount(t.propertyId, "in_house_campers");
    expect(c.sampleEmails).toEqual(["h***@x.com"]);
  });
});

describe("broadcast delivery (audit M12)", () => {
  it("empty audience is rejected instead of silently emailing staff", async () => {
    const t = await seedTenant();
    await expect(
      CommunicationService.createBroadcast(t.orgId, t.propertyId, user, { ...msg, recipientFilter: "in_house_campers" })
    ).rejects.toMatchObject({ name: "ValidationError" });
    expect(await Broadcast.countDocuments()).toBe(0);
  });

  it("record is written before sending; idempotency key prevents a duplicate broadcast", async () => {
    const t = await seedTenant();
    await stay(t, "here@x.com", -1, 2);
    const input = { ...msg, recipientFilter: "all_guests" as const, idempotencyKey: "bcast-key-0001" };
    const [a, b] = await Promise.all([
      CommunicationService.createBroadcast(t.orgId, t.propertyId, user, input),
      CommunicationService.createBroadcast(t.orgId, t.propertyId, user, input),
    ]);
    expect(await Broadcast.countDocuments()).toBe(1);
    expect(String(a.broadcast!._id)).toBe(String(b.broadcast!._id));
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect((a.broadcast as any).status).toBe("queued");
    expect((a.broadcast as any).recipientEmails).toBeUndefined();
  });

  it("delivery is claimed once and records accurate stats", async () => {
    const t = await seedTenant();
    await stay(t, "one@x.com", -1, 2);
    await stay(t, "two@x.com", 3, 5);
    const { broadcast } = await CommunicationService.createBroadcast(t.orgId, t.propertyId, user, { ...msg, recipientFilter: "all_guests" });
    const id = String(broadcast!._id);
    const [first, second] = await Promise.all([
      CommunicationService.deliverBroadcast(id),
      CommunicationService.deliverBroadcast(id),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const done = await Broadcast.findById(id).lean();
    expect(done!.status).toBe("sent");
    expect(done!.deliveryStats).toMatchObject({ total: 2, successful: 2, failed: 0 });
    // a third call is a no-op
    expect(await CommunicationService.deliverBroadcast(id)).toBeNull();
  });

  it("history is bounded and omits recipient lists", async () => {
    const t = await seedTenant();
    await stay(t, "one@x.com", -1, 2);
    await CommunicationService.createBroadcast(t.orgId, t.propertyId, user, { ...msg, recipientFilter: "all_guests" });
    const history = await CommunicationService.getBroadcastHistory(t.orgId, t.propertyId);
    expect(history).toHaveLength(1);
    expect((history[0] as any).recipientEmails).toBeUndefined();
  });
});

describe("stuck broadcast recovery", () => {
  it("re-delivers queued/stalled broadcasts inside the safe window and abandons old ones", async () => {
    const t = await seedTenant();
    await stay(t, "one@x.com", -1, 2);
    const mk = async () => (await CommunicationService.createBroadcast(t.orgId, t.propertyId, user, { ...msg, recipientFilter: "all_guests" })).broadcast!._id as any;
    const now = Date.now();
    const neverStarted = await mk();
    // createdAt is immutable through Mongoose; backdate via the driver.
    await Broadcast.collection.updateOne({ _id: neverStarted }, { $set: { createdAt: new Date(now - 10 * 60_000) } });
    const stalled = await mk();
    await Broadcast.updateOne({ _id: stalled }, { $set: { status: "sending", startedAt: new Date(now - 60 * 60_000), "deliveryStats.successful": 1 } });
    const ancient = await mk();
    await Broadcast.updateOne({ _id: ancient }, { $set: { status: "sending", startedAt: new Date(now - 30 * 3600_000) } });
    const fresh = await mk(); // just queued: after() may still be running → left alone

    const res = await CommunicationService.recoverStuckBroadcasts(new Date(now));
    expect(res).toEqual({ redelivered: 2, abandoned: 1 });
    const byId = async (id: any) => Broadcast.findById(id).lean();
    expect((await byId(neverStarted))!.status).toBe("sent");
    expect((await byId(stalled))!).toMatchObject({ status: "sent", deliveryStats: { successful: 1, failed: 0 } }); // not double counted
    expect((await byId(ancient))!.status).toBe("failed");
    expect((await byId(fresh))!.status).toBe("queued");
  });
});
