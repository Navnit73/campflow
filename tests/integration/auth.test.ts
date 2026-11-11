import { describe, it, expect, vi, afterEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { AuthService } from "@/services/auth.service";
import { MailService } from "@/services/mail.service";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const reg = { name: "Owner", email: "owner@park.com", password: "longpassword1", organizationName: "Pine Park", phone: "5551234567" };
const laptop = { ip: "203.0.113.10", userAgent: "Mozilla/5.0 (Macintosh)" };

describe("login alerts only for new devices", () => {
  it("no alert on the signup device or the same network; alert on a new device, once", async () => {
    const alert = vi.spyOn(MailService, "sendLoginAlert").mockResolvedValue({ success: true } as any);
    await AuthService.register(reg, laptop);

    await AuthService.login({ email: reg.email, password: reg.password }, laptop);
    await AuthService.login({ email: reg.email, password: reg.password }, { ...laptop, ip: "203.0.113.77" }); // same /24
    expect(alert).not.toHaveBeenCalled();

    const phone = { ip: "198.51.100.5", userAgent: "Mozilla/5.0 (iPhone)" };
    await AuthService.login({ email: reg.email, password: reg.password }, phone);
    expect(alert).toHaveBeenCalledTimes(1);
    await AuthService.login({ email: reg.email, password: reg.password }, phone);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("stores only hashed fingerprints, capped at 10", async () => {
    vi.spyOn(MailService, "sendLoginAlert").mockResolvedValue({ success: true } as any);
    await AuthService.register(reg, laptop);
    for (let i = 0; i < 15; i++) {
      await AuthService.login({ email: reg.email, password: reg.password }, { ip: `10.0.${i}.1`, userAgent: "UA" });
    }
    const { User } = await import("@/models/User");
    const u = await User.findOne({ email: reg.email }).select("+knownDevices").lean();
    expect(u!.knownDevices).toHaveLength(10);
    expect(JSON.stringify(u!.knownDevices)).not.toContain("10.0.");
  });

  it("rejects wrong passwords without revealing whether the email exists", async () => {
    await AuthService.register(reg, laptop);
    await expect(AuthService.login({ email: reg.email, password: "wrong-password" })).rejects.toThrow("Invalid email or password");
    await expect(AuthService.login({ email: "nobody@x.com", password: "wrong-password" })).rejects.toThrow("Invalid email or password");
  });
});
