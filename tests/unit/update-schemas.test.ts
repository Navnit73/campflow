import { describe, it, expect } from "vitest";
import { updateSiteSchema, updateSiteTypeSchema } from "@/lib/validations/site.schema";
import { updateGuestSchema } from "@/lib/validations/guest.schema";
import { updateAddOnSchema } from "@/lib/validations/addon.schema";
import { updateScheduleSchema } from "@/lib/validations/export.schema";

// Regression for audit H1: Zod 4 `.partial()` injected defaults, so partial PATCH bodies
// silently reset untouched fields (e.g. an add-on "toggle active" reset category/pricing/icon).
describe("PATCH schemas only contain keys the client sent", () => {
  it("add-on toggle keeps only isActive", () => {
    expect(updateAddOnSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
  it("site rate change doesn't reset status to available", () => {
    expect(updateSiteSchema.parse({ currentBaseRate: 70 })).toEqual({ currentBaseRate: 70 });
  });
  it("site type partial update", () => {
    expect(updateSiteTypeSchema.parse({ name: "Deluxe" })).toEqual({ name: "Deluxe" });
  });
  it("guest partial update keeps notes/isVip untouched", () => {
    expect(updateGuestSchema.parse({ phone: "5550001234" })).toEqual({ phone: "5550001234" });
  });
  it("export schedule toggle keeps type/frequency untouched", () => {
    expect(updateScheduleSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
  it("still validates provided fields", () => {
    expect(() => updateSiteSchema.parse({ status: "bogus" })).toThrow();
    expect(() => updateAddOnSchema.parse({ price: -1 })).toThrow();
  });
  it("nested objects: provided nested keys are kept, missing nested defaults not injected", () => {
    expect(updateGuestSchema.parse({ rvDetails: { lengthFt: 35 } })).toEqual({ rvDetails: { lengthFt: 35 } });
  });
});
