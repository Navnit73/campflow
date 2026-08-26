import mongoose from "mongoose";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { Property } from "@/models/Property";
import { SiteType } from "@/models/SiteType";
import { Site } from "@/models/Site";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { Discount } from "@/models/Discount";
import { hashPassword } from "@/lib/auth/password";
import { calculatePricing } from "@/lib/utils/pricing";
import { generateConfirmationCode } from "@/lib/utils/code-generator";
import { connectDB } from "@/lib/db/connection";

export class SeedService {
  static async seedDemoData() {
    await connectDB();

    console.log("[Seed] Starting database seed for Pine Ridge RV Haven...");

    // Clean up existing demo organization
    const existingOrg = await Organization.findOne({ slug: "pine-ridge" });
    if (existingOrg) {
      await Promise.all([
        User.deleteMany({ organizationId: existingOrg._id }),
        Property.deleteMany({ organizationId: existingOrg._id }),
        SiteType.deleteMany({ organizationId: existingOrg._id }),
        Site.deleteMany({ organizationId: existingOrg._id }),
        Guest.deleteMany({ organizationId: existingOrg._id }),
        Reservation.deleteMany({ organizationId: existingOrg._id }),
        Payment.deleteMany({ organizationId: existingOrg._id }),
        Discount.deleteMany({ organizationId: existingOrg._id }),
        Organization.deleteOne({ _id: existingOrg._id }),
      ]);
    }

    // 1. Create Organization
    const organization = await Organization.create({
      name: "Pine Ridge Outdoors",
      slug: "pine-ridge",
      plan: "growth",
      status: "active",
    });

    // 2. Create Property
    const property = await Property.create({
      organizationId: organization._id,
      name: "Pine Ridge RV Haven & Campground",
      slug: "pine-ridge-rv",
      description: "Nestled along the Arkansas River with breathtaking views of the Collegiate Peaks. Premium full-hookup RV sites, high-speed Wi-Fi, clean private bathhouses, and dog park.",
      address: {
        street: "1420 River Valley Road",
        city: "Buena Vista",
        state: "CO",
        zip: "81211",
        country: "USA",
      },
      phone: "(719) 555-0199",
      email: "stay@pineridgerv.com",
      timezone: "America/Denver",
      currency: "USD",
      checkInTime: "13:00",
      checkOutTime: "11:00",
      taxRatePercent: 7.5,
      rules: [
        "Quiet hours are strictly observed from 10:00 PM to 7:00 AM",
        "Speed limit is 5 MPH throughout all campground loops",
        "Sewer donut/elbow seal is required for all sewer hookups",
        "Pets must be on a 6ft leash and cleaned up after immediately",
        "Campfires in designated steel fire rings only; extinguish before leaving site",
      ],
      amenities: [
        "50/30/20 Amp Power",
        "Fiber High-Speed Wi-Fi",
        "Riverfront Walking Trails",
        "Private Tile Showers & Restrooms",
        "Fenced Off-Leash Dog Park",
        "Propane Refill Station",
        "Coin & App Laundry",
        "Camp Store & Ice/Firewood",
      ],
      bookingPolicy: "Cancellations made 48 hours prior to 1:00 PM check-in receive a full refund minus a $10 processing fee.",
    });

    // 3. Create Users
    const passwordHash = await hashPassword("password123");
    const ownerUser = await User.create({
      organizationId: organization._id,
      name: "Jack Sterling",
      email: "demo@pineridgerv.com",
      passwordHash,
      role: "owner",
      phone: "(719) 555-0101",
      isActive: true,
    });

    const staffUser = await User.create({
      organizationId: organization._id,
      name: "Clara Davis",
      email: "staff@pineridgerv.com",
      passwordHash,
      role: "staff",
      phone: "(719) 555-0102",
      isActive: true,
    });

    organization.ownerUserId = ownerUser._id;
    await organization.save();

    // 4. Create Site Types
    const [type50PullThru, type30BackIn, typeWaterfront, typeTent] = await SiteType.create([
      {
        organizationId: organization._id,
        propertyId: property._id,
        name: "50A Full Hookup Pull-Through",
        category: "rv_site",
        hookups: { electric: "50A", water: true, sewer: true },
        maxRigLength: 45,
        defaultBaseRate: 68,
        maxOccupancy: 6,
        description: "Spacious 75-foot long pull-through site with concrete pad, 50/30/20 Amp power, water, and sewer.",
      },
      {
        organizationId: organization._id,
        propertyId: property._id,
        name: "30A Full Hookup Back-In",
        category: "rv_site",
        hookups: { electric: "30A", water: true, sewer: true },
        maxRigLength: 36,
        defaultBaseRate: 54,
        maxOccupancy: 6,
        description: "Level gravel back-in site with 30A power, water, sewer, and scenic pine shade.",
      },
      {
        organizationId: organization._id,
        propertyId: property._id,
        name: "Riverfront 50A Premium Pull-Through",
        category: "rv_site",
        hookups: { electric: "50A", water: true, sewer: true },
        maxRigLength: 50,
        defaultBaseRate: 85,
        maxOccupancy: 8,
        description: "Premium riverfront spot directly overlooking the water with enlarged patio, propane grill hookup, and 50A service.",
      },
      {
        organizationId: organization._id,
        propertyId: property._id,
        name: "Water & Electric Pop-Up / Tent",
        category: "tent_site",
        hookups: { electric: "20A", water: true, sewer: false },
        maxRigLength: 22,
        defaultBaseRate: 38,
        maxOccupancy: 4,
        description: "Grassy campsite under mature pines with 20A electric, potable water, heavy-duty picnic table, and fire ring.",
      },
    ]);

    // 5. Create 24 Sites across 3 Loops (A, B, C)
    const siteDocs = [];

    // Loop A: Premium & 50A Pull-Throughs (Sites A1 to A8)
    for (let i = 1; i <= 8; i++) {
      const isRiverfront = i <= 3;
      const st = isRiverfront ? typeWaterfront : type50PullThru;
      siteDocs.push({
        organizationId: organization._id,
        propertyId: property._id,
        siteTypeId: st._id,
        siteNumber: `A-${i < 10 ? "0" + i : i}`,
        name: `Site A-${i} (${isRiverfront ? "Riverfront" : "Pull-Thru"})`,
        status: i === 7 ? "maintenance" : "available",
        siteTypeSnapshot: {
          name: st.name,
          category: st.category,
          hookups: st.hookups,
          maxRigLength: st.maxRigLength,
        },
        currentBaseRate: st.defaultBaseRate,
        surfaceType: "concrete",
        rigType: "pull_through",
        amenities: isRiverfront
          ? ["Riverfront View", "Picnic Table", "Fire Pit", "Concrete Pad", "Free Wi-Fi"]
          : ["Picnic Table", "Fire Pit", "Concrete Pad", "Free Wi-Fi"],
        notes: i === 7 ? "Water spigot valve scheduled for maintenance" : "",
        sortOrder: i,
      });
    }

    // Loop B: 30A Full Hookup Back-Ins (Sites B1 to B10)
    for (let i = 1; i <= 10; i++) {
      const st = type30BackIn;
      siteDocs.push({
        organizationId: organization._id,
        propertyId: property._id,
        siteTypeId: st._id,
        siteNumber: `B-${i < 10 ? "0" + i : i}`,
        name: `Site B-${i} (Standard Back-In)`,
        status: "available",
        siteTypeSnapshot: {
          name: st.name,
          category: st.category,
          hookups: st.hookups,
          maxRigLength: st.maxRigLength,
        },
        currentBaseRate: st.defaultBaseRate,
        surfaceType: "gravel",
        rigType: "back_in",
        amenities: ["Picnic Table", "Fire Pit", "Shaded", "Free Wi-Fi"],
        notes: "",
        sortOrder: 10 + i,
      });
    }

    // Loop C: Tent & Pop-Up Shaded Sites (Sites C1 to C6)
    for (let i = 1; i <= 6; i++) {
      const st = typeTent;
      siteDocs.push({
        organizationId: organization._id,
        propertyId: property._id,
        siteTypeId: st._id,
        siteNumber: `C-${i < 10 ? "0" + i : i}`,
        name: `Site C-${i} (Tent / Pop-Up)`,
        status: "available",
        siteTypeSnapshot: {
          name: st.name,
          category: st.category,
          hookups: st.hookups,
          maxRigLength: st.maxRigLength,
        },
        currentBaseRate: st.defaultBaseRate,
        surfaceType: "grass",
        rigType: "tent",
        amenities: ["Picnic Table", "Fire Ring", "Shaded Trees", "Water Hookup"],
        notes: "",
        sortOrder: 20 + i,
      });
    }

    const createdSites = await Site.insertMany(siteDocs);

    // 6. Create Discounts
    const [discGoodSam, discMilitary, discWeekly] = await Discount.create([
      {
        organizationId: organization._id,
        propertyId: property._id,
        code: "GOODSAM",
        name: "Good Sam Member 10% Off",
        type: "percentage",
        value: 10,
        isActive: true,
        usageCount: 14,
      },
      {
        organizationId: organization._id,
        propertyId: property._id,
        code: "MILITARY",
        name: "Military & First Responders 15% Off",
        type: "percentage",
        value: 15,
        isActive: true,
        usageCount: 8,
      },
      {
        organizationId: organization._id,
        propertyId: property._id,
        code: "WEEKLY",
        name: "Weekly Stay Special ($25 Off)",
        type: "fixed_amount",
        value: 25,
        isActive: true,
        usageCount: 5,
      },
    ]);

    // 7. Create Guests
    const guestData = [
      {
        firstName: "Marcus",
        lastName: "Holloway",
        email: "marcus.holloway@example.com",
        phone: "(303) 555-0142",
        rvDetails: { type: "motorhome_a", lengthFt: 42, licensePlate: "CO-849X", makeModel: "Tiffin Phaeton 40AH" },
        isVip: true,
        totalStays: 4,
        totalSpent: 1240,
        notes: "Prefers Riverfront Loop A. Traveling with friendly golden retriever.",
      },
      {
        firstName: "Sarah",
        lastName: "Jenkins",
        email: "sarah.j@example.com",
        phone: "(720) 555-0188",
        rvDetails: { type: "fifth_wheel", lengthFt: 38, licensePlate: "TX-5542B", makeModel: "Keystone Montana 3761FL" },
        isVip: false,
        totalStays: 2,
        totalSpent: 480,
      },
      {
        firstName: "David",
        lastName: "Vance",
        email: "d.vance@example.com",
        phone: "(970) 555-0113",
        rvDetails: { type: "travel_trailer", lengthFt: 31, licensePlate: "UT-991A", makeModel: "Grand Design Imagine 2800BH" },
        isVip: false,
        totalStays: 1,
        totalSpent: 216,
      },
      {
        firstName: "Elena",
        lastName: "Rostova",
        email: "elena.r@example.com",
        phone: "(505) 555-0164",
        rvDetails: { type: "motorhome_b", lengthFt: 21, licensePlate: "NM-420P", makeModel: "Winnebago Solis 59PX" },
        isVip: true,
        totalStays: 3,
        totalSpent: 620,
      },
      {
        firstName: "Robert",
        lastName: "Chen",
        email: "rchen@example.com",
        phone: "(480) 555-0129",
        rvDetails: { type: "travel_trailer", lengthFt: 26, licensePlate: "AZ-772K", makeModel: "Airstream Flying Cloud 25FB" },
        isVip: false,
        totalStays: 1,
        totalSpent: 270,
      },
      {
        firstName: "Jessica",
        lastName: "Miller",
        email: "jessica.m@example.com",
        phone: "(801) 555-0195",
        rvDetails: { type: "tent", lengthFt: 0, licensePlate: "WY-338Z", makeModel: "Coleman 6-Person Dome" },
        isVip: false,
        totalStays: 1,
        totalSpent: 114,
      },
      {
        firstName: "Thomas",
        lastName: "Wright",
        email: "twright@example.com",
        phone: "(312) 555-0177",
        rvDetails: { type: "motorhome_c", lengthFt: 30, licensePlate: "IL-884V", makeModel: "Thor Chateau 28Z" },
        isVip: false,
        totalStays: 2,
        totalSpent: 390,
      },
      {
        firstName: "Amanda",
        lastName: "Brooks",
        email: "amanda.b@example.com",
        phone: "(206) 555-0151",
        rvDetails: { type: "travel_trailer", lengthFt: 28, licensePlate: "WA-621L", makeModel: "Jayco Jay Flight 24RBS" },
        isVip: false,
        totalStays: 1,
        totalSpent: 162,
      },
    ];

    const createdGuests = await Guest.insertMany(
      guestData.map((g) => ({
        organizationId: organization._id,
        propertyId: property._id,
        ...g,
      }))
    );

    // 8. Create Reservations & Payments
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    function makeDates(offsetDaysIn: number, nights: number) {
      const dIn = new Date(Date.now() + offsetDaysIn * 24 * 60 * 60 * 1000);
      const dOut = new Date(dIn.getTime() + nights * 24 * 60 * 60 * 1000);
      return {
        checkInDate: new Date(dIn.toISOString().split("T")[0] + "T00:00:00Z"),
        checkOutDate: new Date(dOut.toISOString().split("T")[0] + "T00:00:00Z"),
        numNights: nights,
      };
    }

    const reservationBlueprints = [
      // 1. Currently checked in (Loop A-01, Riverfront)
      {
        siteIdx: 0,
        guestIdx: 0,
        dates: makeDates(-2, 5),
        status: "checked_in" as const,
        source: "online_booking" as const,
        paid: true,
      },
      // 2. Currently checked in (Loop A-02, Riverfront)
      {
        siteIdx: 1,
        guestIdx: 1,
        dates: makeDates(-1, 4),
        status: "checked_in" as const,
        source: "phone" as const,
        paid: true,
      },
      // 3. Arriving TODAY (Loop A-03)
      {
        siteIdx: 2,
        guestIdx: 2,
        dates: makeDates(0, 3),
        status: "confirmed" as const,
        source: "online_booking" as const,
        paid: true,
      },
      // 4. Arriving TODAY (Loop B-01)
      {
        siteIdx: 8,
        guestIdx: 3,
        dates: makeDates(0, 4),
        status: "confirmed" as const,
        source: "admin" as const,
        paid: false,
      },
      // 5. Departing TODAY (Loop B-02)
      {
        siteIdx: 9,
        guestIdx: 4,
        dates: makeDates(-3, 3),
        status: "checked_in" as const,
        source: "online_booking" as const,
        paid: true,
      },
      // 6. Currently checked in (Loop B-03)
      {
        siteIdx: 10,
        guestIdx: 6,
        dates: makeDates(-2, 6),
        status: "checked_in" as const,
        source: "phone" as const,
        paid: true,
      },
      // 7. Tent Site checked in (Loop C-01)
      {
        siteIdx: 18,
        guestIdx: 5,
        dates: makeDates(-1, 3),
        status: "checked_in" as const,
        source: "walk_in" as const,
        paid: true,
      },
      // 8. Upcoming tomorrow (Loop A-04)
      {
        siteIdx: 3,
        guestIdx: 7,
        dates: makeDates(1, 4),
        status: "confirmed" as const,
        source: "online_booking" as const,
        paid: true,
      },
      // 9. Upcoming next week (Loop B-04)
      {
        siteIdx: 11,
        guestIdx: 0,
        dates: makeDates(4, 3),
        status: "confirmed" as const,
        source: "online_booking" as const,
        paid: true,
      },
      // 10. Completed stay last week (Loop A-05)
      {
        siteIdx: 4,
        guestIdx: 2,
        dates: makeDates(-10, 4),
        status: "checked_out" as const,
        source: "online_booking" as const,
        paid: true,
      },
    ];

    for (const bp of reservationBlueprints) {
      const site = createdSites[bp.siteIdx];
      const guest = createdGuests[bp.guestIdx];

      const pricing = calculatePricing({
        nightlyRate: site.currentBaseRate,
        checkInDate: bp.dates.checkInDate,
        checkOutDate: bp.dates.checkOutDate,
        taxRatePercent: property.taxRatePercent,
      });

      if (bp.paid) {
        pricing.paidAmount = pricing.totalAmount;
        pricing.balanceDue = 0;
      } else {
        pricing.paidAmount = 0;
        pricing.balanceDue = pricing.totalAmount;
      }

      const res = await Reservation.create({
        organizationId: organization._id,
        propertyId: property._id,
        confirmationCode: generateConfirmationCode(),
        siteId: site._id,
        guestId: guest._id,
        siteSnapshot: {
          siteNumber: site.siteNumber,
          siteTypeName: site.siteTypeSnapshot.name,
          hookups: site.siteTypeSnapshot.hookups,
          rigType: site.rigType,
          baseRate: site.currentBaseRate,
        },
        guestSnapshot: {
          fullName: `${guest.firstName} ${guest.lastName}`,
          email: guest.email,
          phone: guest.phone,
          rvType: guest.rvDetails?.type,
          rvLengthFt: guest.rvDetails?.lengthFt,
        },
        checkInDate: bp.dates.checkInDate,
        checkOutDate: bp.dates.checkOutDate,
        numNights: bp.dates.numNights,
        adults: 2,
        children: 0,
        pets: 1,
        status: bp.status,
        pricing,
        source: bp.source,
        specialRequests: "Standard check-in.",
        checkInTimeActual: bp.status === "checked_in" || bp.status === "checked_out" ? bp.dates.checkInDate : undefined,
        checkOutTimeActual: bp.status === "checked_out" ? bp.dates.checkOutDate : undefined,
      });

      if (bp.paid) {
        await Payment.create({
          organizationId: organization._id,
          propertyId: property._id,
          reservationId: res._id,
          guestId: guest._id,
          amount: pricing.totalAmount,
          currency: "USD",
          method: bp.source === "online_booking" ? "online" : "credit_card",
          status: "completed",
          transactionReference: `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          notes: "Full payment received",
          processedByUserId: ownerUser._id,
        });
      }
    }

    console.log("[Seed] Pine Ridge RV Haven successfully seeded with 24 sites, 8 guests, and active reservations!");

    return {
      success: true,
      message: "Seed data created successfully!",
      demoCredentials: {
        email: "demo@pineridgerv.com",
        password: "password123",
        propertySlug: "pine-ridge-rv",
      },
    };
  }
}
