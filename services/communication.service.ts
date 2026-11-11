import mongoose from "mongoose";
import { Broadcast, BroadcastRecipientFilter } from "@/models/Broadcast";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Property } from "@/models/Property";
import { CreateBroadcastInput } from "@/lib/validations/communication.schema";
import { MailService } from "@/services/mail.service";
import { connectDB } from "@/lib/db/connection";
import { addDays, parseDateOnly, zonedDateKey } from "@/lib/utils/date";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";

const oid = (id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id);
const normalize = (emails: (string | null | undefined)[]) =>
  Array.from(new Set(emails.filter(Boolean).map((e) => String(e).toLowerCase().trim()))).filter((e) => e.includes("@"));

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

export class CommunicationService {
  /** Resolves recipient emails for an audience, using the park's local "today". */
  static async resolveAudience(
    propertyId: string,
    filter: BroadcastRecipientFilter
  ): Promise<{ emails: string[]; count: number; description: string }> {
    await connectDB();

    const propId = oid(propertyId);
    const property = await Property.findById(propId).select("timezone").lean();
    const today = parseDateOnly(zonedDateKey(new Date(), property?.timezone));
    const in7Days = addDays(today, 7);

    let emails: string[];
    let description: string;

    if (filter === "in_house_campers") {
      description = "Currently Checked-In & In-House Campers";
      // Guests on site right now: checked in (and not past departure), or confirmed with a stay
      // spanning today. (Previously included arrivals up to 7 days ahead and stale check-ins.)
      emails = await Reservation.distinct("guestSnapshot.email", {
        propertyId: propId,
        $or: [
          { status: "checked_in", checkOutDate: { $gte: today } },
          { status: "confirmed", checkInDate: { $lte: today }, checkOutDate: { $gt: today } },
        ],
      });
    } else if (filter === "upcoming_arrivals") {
      description = "Upcoming Arrivals in the next 7 days";
      emails = await Reservation.distinct("guestSnapshot.email", {
        propertyId: propId,
        status: { $in: ["confirmed", "pending"] },
        checkInDate: { $gte: today, $lte: in7Days },
      });
    } else {
      description = "All Registered Campers in CRM";
      // distinct() returns only unique values instead of streaming every document into Node.
      const [guestEmails, reservationEmails] = await Promise.all([
        Guest.distinct("email", { propertyId: propId, isBlacklisted: { $ne: true } }),
        Reservation.distinct("guestSnapshot.email", { propertyId: propId }),
      ]);
      emails = [...guestEmails, ...reservationEmails];
    }

    const unique = normalize(emails);
    return { emails: unique, count: unique.length, description };
  }

  static async getAudienceCount(propertyId: string, filter: BroadcastRecipientFilter) {
    const audience = await this.resolveAudience(propertyId, filter);
    return {
      filter,
      count: audience.count,
      description: audience.description,
      // Masked: a preview shouldn't expose the guest list.
      sampleEmails: audience.emails.slice(0, 5).map(maskEmail),
    };
  }

  /**
   * Creates the broadcast record (status "queued") BEFORE anything is sent.
   * Delivery happens in `deliverBroadcast`, which the route schedules with `after()` so the HTTP
   * request isn't held open (and can't time out mid-send). With an idempotency key, a retried
   * request returns the existing broadcast instead of sending again.
   */
  static async createBroadcast(
    organizationId: string,
    propertyId: string,
    user: { id: string; name: string },
    input: CreateBroadcastInput & { idempotencyKey?: string }
  ) {
    await connectDB();

    const orgId = oid(organizationId);
    if (input.idempotencyKey) {
      const existing = await Broadcast.findOne({ organizationId: orgId, idempotencyKey: input.idempotencyKey })
        .select("-recipientEmails")
        .lean();
      if (existing) return { broadcast: existing, created: false };
    }

    const property = await Property.findOne({ _id: oid(propertyId), organizationId: orgId }).select("_id").lean();
    if (!property) throw new NotFoundError("Property not found");

    const audience = await this.resolveAudience(propertyId, input.recipientFilter);
    // Previously an empty audience silently emailed staff and was recorded as "sent".
    if (audience.count === 0) {
      throw new ValidationError(`No recipients match "${audience.description}". Nothing was sent.`, {
        recipientFilter: "Audience is empty",
      });
    }

    try {
      const broadcast = await Broadcast.create({
        organizationId: orgId,
        propertyId: oid(propertyId),
        subject: input.subject,
        message: input.message,
        priority: input.priority,
        recipientFilter: input.recipientFilter,
        recipientCount: audience.count,
        recipientEmails: audience.emails,
        deliveryStats: { total: audience.count, successful: 0, failed: 0 },
        sentByUserId: oid(user.id),
        sentByUserName: user.name || "Staff",
        status: "queued",
        idempotencyKey: input.idempotencyKey,
      });
      const obj = broadcast.toObject() as unknown as Record<string, unknown>;
      delete obj.recipientEmails;
      return { broadcast: obj, created: true };
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000 && input.idempotencyKey) {
        const existing = await Broadcast.findOne({ organizationId: orgId, idempotencyKey: input.idempotencyKey })
          .select("-recipientEmails")
          .lean();
        return { broadcast: existing, created: false };
      }
      throw err;
    }
  }

  /**
   * Sends a queued broadcast. The atomic queued→sending claim guarantees it runs at most once;
   * progress is persisted after each batch so a crash leaves an accurate partial record.
   */
  static async deliverBroadcast(broadcastId: string | mongoose.Types.ObjectId) {
    await connectDB();

    const claimed = await Broadcast.findOneAndUpdate(
      { _id: oid(broadcastId), status: "queued" },
      { $set: { status: "sending", startedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();
    if (!claimed) return null; // already sending/sent

    const property = await Property.findById(claimed.propertyId).select("name phone email").lean();

    let result = { sentCount: 0, failedCount: 0 };
    try {
      result = await MailService.sendMassBroadcast({
        recipients: claimed.recipientEmails,
        propertyName: property?.name || "CampFlow RV Resort",
        subject: claimed.subject,
        messageBody: claimed.message,
        priority: claimed.priority,
        propertyPhone: property?.phone,
        propertyEmail: property?.email,
        idempotencyKey: `broadcast-${claimed._id.toString()}`,
        onProgress: async ({ sent, failed }) => {
          await Broadcast.updateOne(
            { _id: claimed._id },
            { $inc: { "deliveryStats.successful": sent, "deliveryStats.failed": failed } }
          );
        },
      });
    } catch (err) {
      console.error("[Broadcast] Delivery crashed:", err);
    }

    const total = claimed.recipientEmails.length;
    const sent = result.sentCount;
    const status = sent === total ? "sent" : sent > 0 ? "partial" : "failed";
    return Broadcast.findOneAndUpdate(
      { _id: claimed._id },
      { $set: { status, completedAt: new Date() } },
      { returnDocument: "after", projection: { recipientEmails: 0 } }
    ).lean();
  }

  /**
   * Recovers broadcasts interrupted by a crash/timeout (run from cron):
   *  - "queued" for > QUEUED_GRACE_MS: the post-response delivery never started → deliver now;
   *  - "sending" for > SENDING_STALE_MS but < RESEND_IDEMPOTENCY_WINDOW_MS: reset and re-deliver.
   *    Safe because every chunk carries a stable idempotency key, so the provider drops chunks that
   *    were already sent;
   *  - older than that window: duplicates can't be ruled out → mark failed instead of resending.
   */
  static async recoverStuckBroadcasts(now: Date = new Date()) {
    await connectDB();
    const QUEUED_GRACE_MS = 2 * 60_000;
    const SENDING_STALE_MS = 15 * 60_000;
    const RESEND_IDEMPOTENCY_WINDOW_MS = 23 * 3600_000; // provider window is 24h; keep a margin
    const t = now.getTime();

    const abandoned = await Broadcast.updateMany(
      { status: "sending", startedAt: { $lt: new Date(t - RESEND_IDEMPOTENCY_WINDOW_MS) } },
      { $set: { status: "failed", completedAt: now, error: "Delivery interrupted and outside the safe resend window" } }
    );

    const resettable = await Broadcast.find({
      status: "sending",
      startedAt: { $lt: new Date(t - SENDING_STALE_MS), $gte: new Date(t - RESEND_IDEMPOTENCY_WINDOW_MS) },
    })
      .select("_id")
      .lean();
    for (const b of resettable) {
      await Broadcast.updateOne(
        { _id: b._id, status: "sending" },
        { $set: { status: "queued", "deliveryStats.successful": 0, "deliveryStats.failed": 0 } }
      );
    }

    const queued = await Broadcast.find({ status: "queued", createdAt: { $lt: new Date(t - QUEUED_GRACE_MS) } })
      .select("_id")
      .lean();
    const ids = new Set([...queued, ...resettable].map((b) => b._id.toString()));
    let redelivered = 0;
    for (const id of ids) if (await this.deliverBroadcast(id)) redelivered++;

    return { redelivered, abandoned: abandoned.modifiedCount };
  }

  /** Recent broadcast history (bounded; recipient lists omitted). */
  static async getBroadcastHistory(organizationId: string, propertyId: string, limit = 50) {
    await connectDB();
    return Broadcast.find({ organizationId: oid(organizationId), propertyId: oid(propertyId) })
      .select("-recipientEmails")
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .lean();
  }
}
