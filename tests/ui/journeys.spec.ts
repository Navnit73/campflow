import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const owner = { email: `ui.owner.${stamp}@example.com`, password: "ui-owner-password-1" };
let context: BrowserContext;
let page: Page;
let slug = "";

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});
test.afterAll(async () => context?.close());

test("owner registers through the UI and lands on the dashboard", async () => {
  await page.goto("/register");
  await page.getByPlaceholder("Whispering Pines RV Resort").fill(`UI Test Park ${stamp}`);
  await page.getByPlaceholder("Sarah Jenkins").fill("Uma Owner");
  await page.getByPlaceholder("sarah@park.com").fill(owner.email);
  await page.getByPlaceholder("(555) 000-0000").fill("5551234567");
  await page.getByPlaceholder("••••••••").fill(owner.password);
  await page.getByRole("button", { name: "Complete Registration" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Occupancy Rate")).toBeVisible();
  await expect(page.getByText("Outstanding Balances")).toBeVisible();
  // A brand-new park gets a setup checklist instead of invented data.
  await expect(page.getByRole("heading", { name: "Finish setting up your park" })).toBeVisible();
  await expect(page.getByText("Confirm tax rate and check-in/out times")).toBeVisible();

  // The session lives in an httpOnly cookie only — nothing in localStorage for scripts to steal.
  expect(await page.evaluate(() => localStorage.getItem("rv_auth_token"))).toBeNull();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "rv_session_token")?.httpOnly).toBe(true);

  slug = (await (await page.request.get("/api/auth/me")).json()).data.property.slug;
});

test("signs out and back in", async () => {
  await page.locator("label", { hasText: "Uma Owner" }).first().click(); // open the account dropdown
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/login/);
  // Signed out for real: protected API now rejects the (cleared) session.
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.getByPlaceholder("you@yourpark.com").fill(owner.email);
  await page.getByPlaceholder("••••••••").fill(owner.password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("settings actually save and survive a reload (was a fake success toast)", async () => {
  await page.goto("/settings");
  await expect(page.getByText("Please review and save.")).toBeVisible(); // defaults are flagged until confirmed
  const street = page.locator("label", { hasText: "Street Address" }).locator("xpath=following-sibling::input[1]");
  const tax = page.locator("label", { hasText: "Lodging Tax Rate" }).locator("xpath=following-sibling::input[1]");
  await street.fill("42 Canyon Rim Rd");
  await page.locator("label", { hasText: "City" }).first().locator("xpath=following-sibling::input[1]").fill("Moab");
  await tax.fill("8.5");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Campground settings saved.")).toBeVisible();

  await page.reload();
  await expect(street).toHaveValue("42 Canyon Rim Rd");
  await expect(tax).toHaveValue("8.5");
  await expect(page.getByText("Please review and save.")).toHaveCount(0);
});

test("new parks start empty: creates a category, then a site, through the modals", async () => {
  await page.goto("/sites");
  // Nothing is pre-filled for a new park (no invented site types or prices).
  await expect(page.getByText("Start by creating your first site category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Site" }).first()).toBeDisabled();

  // Pick a category template; the owner must enter the nightly rate (templates carry no prices).
  await page.getByRole("button", { name: "Choose from Templates" }).click();
  const addBtn = page.getByRole("button", { name: /Add \d* ?selected/ });
  await page.getByLabel("Add 50 Amp Full Hookup Pull-Through").check();
  await expect(addBtn).toBeDisabled(); // no rate yet → can't save
  await page.getByLabel("Nightly rate for 50 Amp Full Hookup Pull-Through").fill("60");
  await addBtn.click();
  await expect(page.getByText("50 Amp Full Hookup Pull-Through").first()).toBeVisible();

  // A custom category through the manual modal still starts with no price.
  await page.getByRole("button", { name: "+ Category" }).click();
  const typeForm = page.locator("form").filter({ has: page.getByPlaceholder("e.g. 50A Full Hookup Pull-Through") });
  await expect(typeForm.locator("label", { hasText: "Default Base Rate" }).locator("xpath=following-sibling::input[1]")).toHaveValue("");
  await typeForm.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Add Site" }).first().click();
  // Scope to the modal's form (the page behind it has its own site-type filter <select>).
  const modal = page.locator("form").filter({ has: page.getByPlaceholder("e.g. A-01, Site 12") });
  const typeSelect = modal.locator("select").filter({ has: page.locator("option", { hasText: "50 Amp" }) }).first();
  await expect(typeSelect.locator("option", { hasText: "50 Amp" })).toHaveCount(1); // types loaded → modal initialised
  const value = await typeSelect.locator("option", { hasText: "50 Amp" }).getAttribute("value");
  await typeSelect.selectOption(value!);
  await modal.getByPlaceholder("e.g. A-01, Site 12").fill("UI-01");
  await modal.getByRole("button", { name: "Save Site" }).click();
  await expect(page.getByText("UI-01").first()).toBeVisible();

  // Regression: a real $0 rate must reopen as $0 (the editor used to show $55).
  const sites = (await (await page.request.get("/api/sites")).json()).data;
  const ui01 = sites.find((x: { siteNumber: string }) => x.siteNumber === "UI-01");
  await page.request.patch(`/api/sites/${ui01._id}`, { data: { currentBaseRate: 0 } });
  await page.reload();
  await page.getByRole("button", { name: "Edit Site UI-01" }).click();
  const rateInput = page.locator("label", { hasText: "Nightly Rate ($)" }).locator("xpath=following-sibling::input[1]");
  await expect(rateInput).toHaveValue("0");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.request.patch(`/api/sites/${ui01._id}`, { data: { currentBaseRate: 60 } });
});

test("toggling an add-on off keeps its category and pricing (audit H1 regression)", async () => {
  await page.goto("/services");
  // Starter list: owner picks items and enters their own prices.
  await page.getByRole("button", { name: "Choose from Starter List" }).first().click();
  await page.getByLabel("Add Firewood Bundle").check();
  await page.getByLabel("Price for Firewood Bundle").fill("9");
  await page.getByRole("button", { name: /Add 1 selected/ }).click();
  await expect(page.getByText("Firewood Bundle").first()).toBeVisible();

  const before = (await (await page.request.get("/api/addons")).json()).data.find((a: { name: string }) => a.name.startsWith("Firewood"));
  const card = page.locator("div").filter({ hasText: "Firewood Bundle" }).filter({ has: page.locator('input[type="checkbox"]') }).last();
  await card.locator('input[type="checkbox"]').click();
  await expect(card.getByText("Inactive")).toBeVisible();

  const after = (await (await page.request.get("/api/addons")).json()).data.find((a: { name: string }) => a.name.startsWith("Firewood"));
  expect(after.isActive).toBe(false);
  expect({ category: after.category, pricingType: after.pricingType, icon: after.icon, taxable: after.taxable, sortOrder: after.sortOrder }).toEqual({
    category: before.category, pricingType: before.pricingType, icon: before.icon, taxable: before.taxable, sortOrder: before.sortOrder,
  });
  // Re-enable for the booking journey.
  await card.locator('input[type="checkbox"]').click();
  await expect(card.getByText("Active").first()).toBeVisible();
});

test("a camper books online and the confirmation shows the balance due at the park", async ({ browser }) => {
  const guest = await browser.newContext(); // anonymous browser
  const g = await guest.newPage();
  await g.goto(`/book/${slug}`);
  await expect(g.getByText("Book Your RV Site or Campsite")).toBeVisible();
  await g.getByRole("button", { name: "Find Available Sites" }).click();
  await g.getByRole("button", { name: /Book Site/ }).first().click();

  await expect(g.getByText("Pay at the Park")).toBeVisible();
  // Regression: the tax label shows the park's real rate (was hard-coded "7.5%").
  await expect(g.getByText("Taxes (8.5%):")).toBeVisible();
  await expect(g.getByText(/7\.5%/)).toHaveCount(0);
  await expect(g.getByText(/automatically authorized/i)).toHaveCount(0); // misleading copy removed
  await g.getByPlaceholder("Marcus", { exact: true }).fill("Casey");
  await g.getByPlaceholder("Holloway", { exact: true }).fill("Camper");
  await g.getByPlaceholder("marcus@example.com").fill(`casey.${stamp}@example.com`);
  await g.getByPlaceholder("(555) 000-0000").fill("5559876543");
  await g.getByRole("button", { name: /Reserve Site/ }).click();

  await expect(g).toHaveURL(new RegExp(`/book/${slug}/confirmation/RV-`));
  await expect(g.getByText("Balance Due at Park")).toBeVisible();
  await expect(g.getByText("Casey Camper")).toBeVisible();
  await expect(g.getByText(/42 Canyon Rim Rd, Moab/)).toBeVisible(); // real address from Settings
  await expect(g.getByText(/Pine Creek|Mountain View/)).toHaveCount(0); // no placeholder address
  await guest.close();

  // Staff dashboard reflects the new arrival right away (cache invalidated by the booking).
  await page.goto("/dashboard");
  await expect(page.getByText(/Today's Arrivals \(1\)/)).toBeVisible();
  // Setup complete → the checklist becomes the live booking-link bar.
  await expect(page.getByText("Your park is set up and taking online bookings:")).toBeVisible();
});
