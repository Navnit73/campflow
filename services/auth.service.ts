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
import { deviceFingerprint, LoginContext, MAX_KNOWN_DEVICES } from "@/lib/auth/device";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// bcrypt hash of a random string; used to equalize login timing for unknown emails.
const DUMMY_PASSWORD_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Pp0xQ4Y0b3E0Gg1YJ8Wf5i3vX9pW";

export class AuthService {
  static async register(input: RegisterInput, ctx: LoginContext = {}) {
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
        // No invented content: description, rules, amenities, policies and site types are entered
        // by the owner (Settings / Sites). Previously every new park got fabricated amenities
        // ("Free High-Speed Wi-Fi", "Dog Park"…), rules, a 7.5% tax rate and three priced site types.
        description: "",
        address: { street: "", city: "", state: "", zip: "", country: "USA" },
        phone: input.phone,
        email: input.email.toLowerCase(),
        timezone: input.timezone || "UTC", // the owner's browser timezone, editable in Settings
        currency: "USD",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        taxRatePercent: 0,
        rules: [],
        amenities: [],
      });

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
        knownDevices: [deviceFingerprint(ctx)], // signup device is trusted
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

  static async login(input: LoginInput, ctx: LoginContext = {}) {
    await connectDB();

    const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select("+knownDevices");

    // Always run one bcrypt comparison so response time doesn't reveal whether the email exists.
    const isValid = await verifyPassword(input.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user || !user.isActive || !isValid) {
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

    // Security alert only for a device/network not seen recently (previously sent on every login).
    const fingerprint = deviceFingerprint(ctx);
    const known = user.knownDevices || [];
    const isNewDevice = !known.includes(fingerprint);
    await User.updateOne(
      { _id: user._id },
      { $set: { knownDevices: [...known.filter((f) => f !== fingerprint), fingerprint].slice(-MAX_KNOWN_DEVICES) } }
    );
    if (isNewDevice) {
      MailService.sendLoginAlert({
        to: user.email,
        userName: user.name,
        loginTime: new Date().toLocaleString("en-US", { timeZone: property.timezone || "UTC" }),
      }).catch((err) => console.error("[Mail Error] Failed to send login alert:", err));
    }

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
