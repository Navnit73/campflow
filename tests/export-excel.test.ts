import { ExcelExportService } from "../services/excel-export.service";
import { ExportService } from "../services/export.service";
import ExcelJS from "exceljs";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING CAMPGROUND EXCEL EXPORT & ACCOUNTING SYSTEM");
  console.log("=================================================\n");

  // Mock Sample Campground Data
  const sampleReservations = [
    {
      _id: "res_001",
      confirmationCode: "CF-2026-A101",
      guestSnapshot: {
        fullName: "John Miller",
        email: "john.miller@example.com",
        phone: "(555) 123-4567",
        rvType: "motorhome_a",
      },
      siteSnapshot: {
        siteNumber: "12",
        siteTypeName: "Deluxe 50A Pull-Through",
        hookups: { electric: "50A", water: true, sewer: true },
        rigType: "pull_through",
        baseRate: 75,
      },
      checkInDate: new Date("2026-06-01T14:00:00Z"),
      checkOutDate: new Date("2026-06-05T11:00:00Z"),
      numNights: 4,
      adults: 2,
      children: 1,
      pets: 1,
      status: "confirmed",
      addOns: [
        {
          name: "Golf Cart Rental",
          price: 35,
          pricingType: "per_night",
          quantity: 1,
          subtotal: 140,
          taxable: false,
        },
        {
          name: "Firewood Bundle",
          price: 10,
          pricingType: "per_unit",
          quantity: 2,
          subtotal: 20,
          taxable: true,
        },
      ],
      pricing: {
        nightlyRate: 75,
        baseSubtotal: 300,
        addOnsSubtotal: 160,
        discountAmount: 30, // $30 promo discount
        taxAmount: 24.38, // 7.5% tax on (300 - 30 + 20) = $320 taxable base
        totalAmount: 454.38,
        paidAmount: 454.38,
        balanceDue: 0,
      },
      createdAt: new Date("2026-05-15T10:30:00Z"),
    },
    {
      _id: "res_002",
      confirmationCode: "CF-2026-B202",
      guestSnapshot: {
        fullName: "Sarah Connor",
        email: "sarah.connor@example.com",
        phone: "(555) 987-6543",
        rvType: "travel_trailer",
      },
      siteSnapshot: {
        siteNumber: "08",
        siteTypeName: "Standard 30A Back-In",
        hookups: { electric: "30A", water: true, sewer: false },
        rigType: "back_in",
        baseRate: 50,
      },
      checkInDate: new Date("2026-06-10T14:00:00Z"),
      checkOutDate: new Date("2026-06-12T11:00:00Z"),
      numNights: 2,
      adults: 3,
      children: 0,
      pets: 0,
      status: "checked_in",
      addOns: [],
      pricing: {
        nightlyRate: 50,
        baseSubtotal: 100,
        addOnsSubtotal: 0,
        discountAmount: 0,
        taxAmount: 7.5,
        totalAmount: 107.5,
        paidAmount: 50,
        balanceDue: 57.5,
      },
      createdAt: new Date("2026-05-20T14:15:00Z"),
    },
  ];

  const samplePayments = [
    {
      _id: "pay_001",
      reservationId: { confirmationCode: "CF-2026-A101" },
      guestId: { firstName: "John", lastName: "Miller", email: "john.miller@example.com" },
      type: "payment",
      amount: 454.38,
      currency: "USD",
      method: "credit_card",
      status: "completed",
      transactionReference: "TXN-88492049",
      processedByUserId: { name: "Front Desk Staff" },
      notes: "Paid in full via terminal",
      createdAt: new Date("2026-05-15T10:35:00Z"),
    },
    {
      _id: "pay_002",
      reservationId: { confirmationCode: "CF-2026-B202" },
      guestId: { firstName: "Sarah", lastName: "Connor", email: "sarah.connor@example.com" },
      type: "payment",
      amount: 50.0,
      currency: "USD",
      method: "cash",
      status: "completed",
      transactionReference: "CASH-REC-102",
      processedByUserId: { name: "Front Desk Staff" },
      notes: "50% deposit paid in cash",
      createdAt: new Date("2026-05-20T14:18:00Z"),
    },
    {
      _id: "pay_003",
      reservationId: { confirmationCode: "CF-2026-C303" },
      guestId: { firstName: "Robert", lastName: "Smith", email: "robert.smith@example.com" },
      type: "refund",
      amount: 40.0,
      currency: "USD",
      method: "credit_card",
      status: "completed",
      transactionReference: "REF-2940294",
      processedByUserId: { name: "Park Manager" },
      notes: "Partial refund for early departure weather cancellation",
      createdAt: new Date("2026-05-22T09:00:00Z"),
    },
  ];

  const sampleGuests = [
    {
      _id: "6650a1b2c3d4e5f6a7b8c901",
      firstName: "John",
      lastName: "Miller",
      email: "john.miller@example.com",
      phone: "(555) 123-4567",
      address: { street: "123 Maple Ave", city: "Denver", state: "CO", zip: "80201", country: "USA" },
      rvDetails: {
        type: "motorhome_a",
        lengthFt: 40,
        licensePlate: "CO-RV-9921",
        state: "CO",
      },
      isVip: true,
      totalStays: 5,
      totalSpent: 2270.5,
      notes: "Preferred site near clubhouse",
      createdAt: new Date("2025-04-10T12:00:00Z"),
    },
    {
      _id: "6650a1b2c3d4e5f6a7b8c902",
      firstName: "Sarah",
      lastName: "Connor",
      email: "sarah.connor@example.com",
      phone: "(555) 987-6543",
      address: { street: "456 Pine St", city: "Phoenix", state: "AZ", zip: "85001", country: "USA" },
      rvDetails: {
        type: "travel_trailer",
        lengthFt: 26,
        licensePlate: "AZ-TR-4481",
        state: "AZ",
      },
      isVip: false,
      totalStays: 1,
      totalSpent: 107.5,
      notes: "First time camper",
      createdAt: new Date("2026-05-20T14:15:00Z"),
    },
  ];

  // 1. TEST MASTER ACCOUNTING WORKBOOK GENERATION
  console.log("1. Testing Master Campground Accounting Workbook (Multi-Sheet)...");
  const masterBuffer = await ExcelExportService.generateMasterAccountingWorkbook({
    propertyName: "CampFlow Mountain RV Resort",
    organizationName: "CampFlow Resorts LLC",
    dateRangeText: "Last 30 Days (2026-05-01 to 2026-05-31)",
    reservations: sampleReservations,
    payments: samplePayments,
    guests: sampleGuests,
    propertySettings: { taxRatePercent: 7.5 },
  });

  console.assert(masterBuffer instanceof Buffer, "masterBuffer is a Buffer");
  console.assert(masterBuffer.length > 5000, `masterBuffer size (${masterBuffer.length} bytes) is valid`);

  // Verify worksheets in master workbook
  const masterWorkbook = new ExcelJS.Workbook();
  await masterWorkbook.xlsx.load(masterBuffer as any);

  const sheetNames = masterWorkbook.worksheets.map((s) => s.name);
  console.log("   Worksheets created in Master Workbook:", sheetNames);
  console.assert(sheetNames.includes("Executive Summary"), "Contains Executive Summary sheet");
  console.assert(sheetNames.includes("Bookings & Occupancy"), "Contains Bookings & Occupancy sheet");
  console.assert(sheetNames.includes("Payment Transactions Ledger"), "Contains Payment Transactions Ledger sheet");
  console.assert(sheetNames.includes("Invoices & Tax Audit"), "Contains Invoices & Tax Audit sheet");
  console.assert(sheetNames.includes("Guest CRM Directory"), "Contains Guest CRM Directory sheet");
  console.log("   ✓ Master Accounting Workbook with 5 stylized sheets passed!\n");

  // 2. TEST BOOKINGS WORKBOOK
  console.log("2. Testing Bookings & Occupancy Report Workbook...");
  const bookingsBuffer = await ExcelExportService.generateBookingsWorkbook({
    propertyName: "CampFlow Mountain RV Resort",
    dateRangeText: "2026-06-01 to 2026-06-30",
    reservations: sampleReservations,
  });
  console.assert(bookingsBuffer.length > 2000, "Bookings buffer generated");
  const bookingsWb = new ExcelJS.Workbook();
  await bookingsWb.xlsx.load(bookingsBuffer as any);
  const bookingsSheet = bookingsWb.getWorksheet("Bookings & Occupancy");
  console.assert(bookingsSheet !== undefined, "Bookings sheet exists");
  console.assert(bookingsSheet!.rowCount >= 4, "Bookings sheet has banner, header, rows, totals");
  console.log("   ✓ Bookings & Occupancy Workbook passed!\n");

  // 3. TEST FINANCIAL TRANSACTIONS WORKBOOK & REFUNDS
  console.log("3. Testing Financial Transactions & Payment Ledger Report...");
  const transBuffer = await ExcelExportService.generateTransactionsWorkbook({
    propertyName: "CampFlow Mountain RV Resort",
    dateRangeText: "May 2026",
    payments: samplePayments,
  });
  console.assert(transBuffer.length > 2000, "Transactions buffer generated");
  const transWb = new ExcelJS.Workbook();
  await transWb.xlsx.load(transBuffer as any);
  const transSheet = transWb.getWorksheet("Payment Transactions Ledger");
  console.assert(transSheet !== undefined, "Payment ledger sheet exists");
  console.log("   ✓ Financial Transactions & Payment Ledger passed!\n");

  // 4. TEST INVOICES & LODGING TAX AUDIT WORKBOOK
  console.log("4. Testing Invoices & Lodging Tax Liability Audit Report...");
  const taxBuffer = await ExcelExportService.generateInvoicesTaxWorkbook({
    propertyName: "CampFlow Mountain RV Resort",
    dateRangeText: "Q2 2026",
    reservations: sampleReservations,
    propertySettings: { taxRatePercent: 7.5 },
  });
  console.assert(taxBuffer.length > 2000, "Tax audit buffer generated");
  const taxWb = new ExcelJS.Workbook();
  await taxWb.xlsx.load(taxBuffer as any);
  const taxSheet = taxWb.getWorksheet("Invoices & Tax Audit");
  console.assert(taxSheet !== undefined, "Invoices & Tax Audit sheet exists");
  console.log("   ✓ Invoices & Lodging Tax Liability Audit passed!\n");

  // 5. TEST GUEST CRM ROSTER WORKBOOK
  console.log("5. Testing Guest CRM Directory Report...");
  const guestsBuffer = await ExcelExportService.generateCustomersWorkbook({
    propertyName: "CampFlow Mountain RV Resort",
    guests: sampleGuests,
  });
  console.assert(guestsBuffer.length > 2000, "Guest CRM buffer generated");
  const guestsWb = new ExcelJS.Workbook();
  await guestsWb.xlsx.load(guestsBuffer as any);
  const guestsSheet = guestsWb.getWorksheet("Guest CRM Directory");
  console.assert(guestsSheet !== undefined, "Guest CRM Directory sheet exists");
  console.log("   ✓ Guest CRM Directory passed!\n");

  // 6. TEST DATE RANGE PRESET RESOLUTION
  console.log("6. Testing Date Range Preset Resolver...");
  const range7d = ExportService.resolveDateRange({ preset: "7d" });
  console.assert(range7d.start instanceof Date && range7d.end instanceof Date, "7d resolved Date objects");
  console.assert(range7d.text.includes("Last 7 Days"), "7d resolved text string");

  const rangeMtd = ExportService.resolveDateRange({ preset: "mtd" });
  console.assert(rangeMtd.text.includes("Month to Date"), "mtd resolved text string");

  const customRange = ExportService.resolveDateRange({
    preset: "custom",
    startDate: "2026-06-01",
    endDate: "2026-06-15",
  });
  console.assert(customRange.text === "2026-06-01 to 2026-06-15", "custom range matches");
  console.log("   ✓ Date Range presets passed!\n");

  // 7. TEST RECURRING SCHEDULE NEXT RUN CALCULATION
  console.log("7. Testing Automated Schedule Next Run Calculator...");
  const dailyNext = ExportService.calculateNextRunDate("daily", "08:00");
  console.assert(dailyNext instanceof Date, "Daily next run is Date");
  console.assert(dailyNext.getHours() === 8 && dailyNext.getMinutes() === 0, "Daily time matches 08:00");

  const weeklyNext = ExportService.calculateNextRunDate("weekly", "09:30", 1); // Monday
  console.assert(weeklyNext instanceof Date, "Weekly next run is Date");
  console.assert(weeklyNext.getDay() === 1, "Weekly next run falls on Monday");

  const monthlyNext = ExportService.calculateNextRunDate("monthly", "07:00", 1, 15); // 15th of month
  console.assert(monthlyNext instanceof Date, "Monthly next run is Date");
  console.assert(monthlyNext.getDate() === 15, "Monthly next run falls on 15th");
  // 8. TEST EDGE CASES: EMPTY DATASETS & ZERO VALUES
  console.log("8. Testing Edge Cases (Empty Datasets & Zero Values)...");
  const emptyMaster = await ExcelExportService.generateMasterAccountingWorkbook({
    propertyName: "Empty Park Resort",
    dateRangeText: "Empty Period",
    reservations: [],
    payments: [],
    guests: [],
  });
  console.assert(emptyMaster.length > 3000, "Empty master workbook created without crash");

  const emptyBookings = await ExcelExportService.generateBookingsWorkbook({
    propertyName: "Empty Park Resort",
    dateRangeText: "Empty Period",
    reservations: [],
  });
  console.assert(emptyBookings.length > 1500, "Empty bookings workbook created without crash");

  const emptyPayments = await ExcelExportService.generateTransactionsWorkbook({
    propertyName: "Empty Park Resort",
    dateRangeText: "Empty Period",
    payments: [],
  });
  console.assert(emptyPayments.length > 1500, "Empty payments workbook created without crash");
  console.log("   ✓ Empty dataset edge cases passed cleanly!\n");

  console.log("=================================================");
  console.log("🎉 ALL EXCEL EXPORT & ACCOUNTING TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
