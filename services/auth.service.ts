import mongoose from "mongoose";
import { User, IUser } from "@/models/User";
import { Organization, IOrganization } from "@/models/Organization";
import { Property, IProperty } from "@/models/Property";
import { SiteType } from "@/models/SiteType";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAuthToken } from "@/lib/auth/jwt";
import { LoginInput, RegisterInput } from "@/lib/validations/auth.schema";
import { connectDB } from "@/lib/db/connection";
import { MailService } from "@/services/mail.service";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

export class AuthService {
  static async register(input: RegisterInput) {
    await connectDB();

    const existingUser = await User.findOne({ email: input.email.toLowerCase() }).lean();
    if (existingUser) {
      const err = new Error("An account with this email address already exists.");
      err.name = "ConflictError";
      throw err;
    }

    let createdOrgId: any = null;
    try {
      // 1. Create Organization
      const baseSlug = slugify(input.organizationName);
      let orgSlug = baseSlug;
      let count = 1;
      while (await Organization.findOne({ slug: orgSlug })) {
        orgSlug = `${baseSlug}-${count++}`;
      }

      const organization = await Organization.create({
        name: input.organizationName,
        slug: orgSlug,
        plan: "starter",
        status: "active",
      });
      createdOrgId = organization._id;

      // 2. Create Default Property
      const propName = input.propertyName || input.organizationName;
      let propSlug = slugify(propName);
      let propCount = 1;
      while (await Property.findOne({ slug: propSlug })) {
        propSlug = `${slugify(propName)}-${propCount++}`;
      }

      const property = await Property.create({
        organizationId: organization._id,
        name: propName,
        slug: propSlug,
        description: `Welcome to ${propName}! A peaceful RV retreat for campers and adventurers.`,
        address: {
          street: "100 Pine Valley Way",
          city: "Mountain View",
          state: "CO",
          zip: "80424",
          country: "USA",
        },
        phone: input.phone,
        email: input.email.toLowerCase(),
        timezone: "America/Denver",
        currency: "USD",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        taxRatePercent: 7.5,
        rules: [
          "Quiet hours: 10:00 PM to 7:00 AM",
          "Speed limit: 5 MPH throughout the park",
          "Pets must be on a leash at all times",
          "Fires permitted in designated fire rings only",
        ],
        amenities: ["Free High-Speed Wi-Fi", "Clean Showers & Bathhouse", "Dog Park", "Camp Store", "Propane Refill"],
      });

      // 3. Create Default Site Types
      await SiteType.create([
        {
          organizationId: organization._id,
          propertyId: property._id,
          name: "50 Amp Full Hookup Pull-Through",
          category: "rv_site",
          hookups: { electric: "50A", water: true, sewer: true },
          maxRigLength: 45,
          defaultBaseRate: 65,
          maxOccupancy: 6,
          description: "Spacious pull-through site with 50/30/20A power, water, sewer, and concrete pad.",
        },
        {
          organizationId: organization._id,
          propertyId: property._id,
          name: "30 Amp Full Hookup Back-In",
          category: "rv_site",
          hookups: { electric: "30A", water: true, sewer: true },
          maxRigLength: 35,
          defaultBaseRate: 52,
          maxOccupancy: 6,
          description: "Standard back-in site with 30A power, water, and sewer hookups.",
        },
        {
          organizationId: organization._id,
          propertyId: property._id,
          name: "Water & Electric Pop-Up / Tent",
          category: "tent_site",
          hookups: { electric: "20A", water: true, sewer: false },
          maxRigLength: 20,
          defaultBaseRate: 35,
          maxOccupancy: 4,
          description: "Shaded primitive site with 20A electric, potable water, fire pit, and picnic table.",
        },
      ]);

      // 4. Create Owner User
      const passwordHash = await hashPassword(input.password);
      const user = await User.create({
        organizationId: organization._id,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "owner",
        phone: input.phone,
        isActive: true,
      });

      // Update organization owner ref
      organization.ownerUserId = user._id;
      await organization.save();

      const token = signAuthToken({
        userId: user._id.toString(),
        organizationId: organization._id.toString(),
        propertyId: property._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      });

      // Send Welcome Registration Email asynchronously
      MailService.sendRegistrationWelcome({
        to: user.email,
        userName: user.name,
        organizationName: organization.name,
        propertyName: property.name,
      }).catch((err) => console.error("[Mail Error] Failed to send welcome email:", err));

      return {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: organization._id.toString(),
          propertyId: property._id.toString(),
        },
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          slug: organization.slug,
        },
        property: {
          id: property._id.toString(),
          name: property.name,
          slug: property.slug,
        },
        token,
      };
    } catch (err) {
      if (createdOrgId) {
        await Promise.all([
          User.deleteMany({ organizationId: createdOrgId }),
          Property.deleteMany({ organizationId: createdOrgId }),
          SiteType.deleteMany({ organizationId: createdOrgId }),
          Organization.deleteOne({ _id: createdOrgId }),
        ]).catch(() => {});
      }
      throw err;
    }
  }

  static async login(input: LoginInput) {
    await connectDB();

    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user || !user.isActive) {
      const err = new Error("Invalid email or password");
      err.name = "UnauthorizedError";
      throw err;
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      const err = new Error("Invalid email or password");
      err.name = "UnauthorizedError";
      throw err;
    }

    const [organization, property] = await Promise.all([
      Organization.findById(user.organizationId).lean(),
      Property.findOne({ organizationId: user.organizationId }).lean(),
    ]);

    if (!organization || !property) {
      const err = new Error("Organization or Property profile not found");
      err.name = "NotFoundError";
      throw err;
    }

    const token = signAuthToken({
      userId: user._id.toString(),
      organizationId: organization._id.toString(),
      propertyId: property._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Send Login Security Alert asynchronously
    MailService.sendLoginAlert({
      to: user.email,
      userName: user.name,
      loginTime: new Date().toLocaleString("en-US", { timeZone: property.timezone || "America/Denver" }),
    }).catch((err) => console.error("[Mail Error] Failed to send login alert:", err));

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: organization._id.toString(),
        propertyId: property._id.toString(),
      },
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
      },
      property: {
        id: property._id.toString(),
        name: property.name,
        slug: property.slug,
      },
      token,
    };
  }

  static async getMe(userId: string) {
    await connectDB();

    const user = await User.findById(userId).select("-passwordHash").lean();
    if (!user || !user.isActive) {
      const err = new Error("User not found or inactive");
      err.name = "NotFoundError";
      throw err;
    }

    const [organization, property] = await Promise.all([
      Organization.findById(user.organizationId).lean(),
      Property.findOne({ organizationId: user.organizationId }).lean(),
    ]);

    return {
      user,
      organization,
      property,
    };
  }
}
