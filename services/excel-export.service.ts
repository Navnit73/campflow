import ExcelJS from "exceljs";
import { formatCurrency } from "@/lib/utils/format";

// Theme color constants (ARGB format for ExcelJS)
const COLORS = {
  BRAND_EMERALD: "FF059669",
  BRAND_DARK: "FF064E3B",
  BRAND_LIGHT: "FFECFDF5",
  SLATE_HEADER: "FF1E293B",
  SLATE_MUTED: "FF64748B",
  SLATE_LIGHT: "FFF8FAFC",
  BORDER_COLOR: "FFE2E8F0",
  BORDER_DARK: "FFCBD5E1",
  SUCCESS_GREEN: "FF16A34A",
  DANGER_RED: "FFE11D48",
  ACCENT_SKY: "FF0284C7",
};

// Common reusable cell styles
const STYLES = {
  header: {
    font: { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.BRAND_EMERALD } },
    alignment: { vertical: "middle" as const, horizontal: "center" as const, wrapText: true },
    border: {
      top: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
      left: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
      bottom: { style: "medium" as const, color: { argb: COLORS.BORDER_DARK } },
      right: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
    },
  },
  subHeader: {
    font: { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.SLATE_HEADER } },
    alignment: { vertical: "middle" as const, horizontal: "center" as const, wrapText: true },
    border: {
      top: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
      left: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
      bottom: { style: "medium" as const, color: { argb: COLORS.BORDER_DARK } },
      right: { style: "thin" as const, color: { argb: COLORS.BORDER_DARK } },
    },
  },
  totalRow: {
    font: { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0F172A" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.BRAND_LIGHT } },
    border: {
      top: { style: "thin" as const, color: { argb: COLORS.BRAND_EMERALD } },
      bottom: { style: "double" as const, color: { argb: COLORS.BRAND_EMERALD } },
    },
  },
  cellBorder: {
    top: { style: "thin" as const, color: { argb: COLORS.BORDER_COLOR } },
    left: { style: "thin" as const, color: { argb: COLORS.BORDER_COLOR } },
    bottom: { style: "thin" as const, color: { argb: COLORS.BORDER_COLOR } },
    right: { style: "thin" as const, color: { argb: COLORS.BORDER_COLOR } },
  },
};

export class ExcelExportService {
  /**
   * Helper to format and auto-fit worksheet columns
   */
  private static autofitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12) {
    worksheet.columns.forEach((column) => {
      let maxLen = minWidth;
      if (column && column.eachCell) {
        column.eachCell({ includeEmpty: false }, (cell) => {
          // Ignore top merged banner title rows (row <= 2) to avoid stretching column A unnecessarily
          if (Number(cell.row) <= 2) return;

          const val = cell.value;
          if (val) {
            let str = "";
            if (typeof val === "object" && "result" in val) {
              str = String(val.result || "");
            } else if (typeof val === "object" && "formula" in val) {
              str = "$999,999.00";
            } else {
              str = String(val);
            }
            if (str.length > maxLen) {
              maxLen = str.length;
            }
          }
        });
      }
      column.width = Math.min(Math.max(maxLen + 3, minWidth), 45);
    });
  }

  /**
   * 1. MASTER CAMPGROUND ACCOUNTING WORKBOOK (Multi-Sheet Comprehensive)
   */
  static async generateMasterAccountingWorkbook(params: {
    propertyName: string;
    organizationName?: string;
    dateRangeText: string;
    reservations: any[];
    payments: any[];
    guests: any[];
    propertySettings?: any;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampFlow RV Management";
    workbook.created = new Date();

    // 1. Cover / Executive Dashboard Sheet
    this.addExecutiveSummarySheet(workbook, params);

    // 2. Bookings & Occupancy Sheet
    this.addBookingsSheet(workbook, params.reservations);

    // 3. Payment Transactions Ledger Sheet
    this.addPaymentsSheet(workbook, params.payments);

    // 4. Invoices & Tax Liability Audit Sheet
    this.addInvoicesTaxSheet(workbook, params.reservations, params.propertySettings);

    // 5. Guest CRM Roster Sheet
    this.addGuestsSheet(workbook, params.guests);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * 2. BOOKINGS & OCCUPANCY WORKBOOK
   */
  static async generateBookingsWorkbook(params: {
    propertyName: string;
    dateRangeText: string;
    reservations: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampFlow RV Management";
    workbook.created = new Date();

    this.addBookingsSheet(workbook, params.reservations, params.propertyName, params.dateRangeText);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * 3. FINANCIAL TRANSACTIONS & PAYMENT LEDGER WORKBOOK
   */
  static async generateTransactionsWorkbook(params: {
    propertyName: string;
    dateRangeText: string;
    payments: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampFlow RV Management";
    workbook.created = new Date();

    this.addPaymentsSheet(workbook, params.payments, params.propertyName, params.dateRangeText);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * 4. INVOICES & TAX LIABILITY AUDIT WORKBOOK
   */
  static async generateInvoicesTaxWorkbook(params: {
    propertyName: string;
    dateRangeText: string;
    reservations: any[];
    propertySettings?: any;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampFlow RV Management";
    workbook.created = new Date();

    this.addInvoicesTaxSheet(
      workbook,
      params.reservations,
      params.propertySettings,
      params.propertyName,
      params.dateRangeText
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * 5. GUEST CRM DIRECTORY WORKBOOK
   */
  static async generateCustomersWorkbook(params: {
    propertyName: string;
    guests: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampFlow RV Management";
    workbook.created = new Date();

    this.addGuestsSheet(workbook, params.guests, params.propertyName);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ==========================================
  // WORKSHEET BUILDERS
  // ==========================================

  /**
   * Executive Summary Cover Sheet
   */
  private static addExecutiveSummarySheet(
    workbook: ExcelJS.Workbook,
    params: {
      propertyName: string;
      organizationName?: string;
      dateRangeText: string;
      reservations: any[];
      payments: any[];
      guests: any[];
    }
  ) {
    const sheet = workbook.addWorksheet("Executive Summary", {
      views: [{ showGridLines: true }],
    });

    // Title Banner
    sheet.mergeCells("A1:F1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `${params.propertyName.toUpperCase()} — FINANCIAL & OPERATIONS AUDIT`;
    titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.BRAND_EMERALD },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 40;

    sheet.mergeCells("A2:F2");
    const subCell = sheet.getCell("A2");
    subCell.value = `Export Period: ${params.dateRangeText}  |  Generated on: ${new Date().toLocaleString()}`;
    subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFFFF" } };
    subCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.BRAND_DARK },
    };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 24;

    sheet.addRow([]); // Blank line

    // Calculate Summary KPIs
    const completedPayments = params.payments.filter((p) => p.status === "completed" && p.type !== "refund");
    const refundPayments = params.payments.filter((p) => p.status === "completed" && p.type === "refund");

    const grossPayments = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunds = refundPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const netRevenue = grossPayments - totalRefunds;

    const totalBookingsValue = params.reservations.reduce((sum, r) => sum + (r.pricing?.totalAmount || 0), 0);
    const totalTaxCollected = params.reservations.reduce((sum, r) => sum + (r.pricing?.taxAmount || 0), 0);
    const totalBalanceDue = params.reservations.reduce((sum, r) => sum + (r.pricing?.balanceDue || 0), 0);
    const totalNights = params.reservations.reduce((sum, r) => sum + (r.numNights || 1), 0);

    // KPI Metrics Section
    sheet.mergeCells("A4:C4");
    const kpiHeader1 = sheet.getCell("A4");
    kpiHeader1.value = "FINANCIAL PERFORMANCE SUMMARY";
    kpiHeader1.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    kpiHeader1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.SLATE_HEADER } };
    sheet.getRow(4).height = 24;

    sheet.mergeCells("D4:F4");
    const kpiHeader2 = sheet.getCell("D4");
    kpiHeader2.value = "CAMPGROUND OCCUPANCY & GUEST METRICS";
    kpiHeader2.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    kpiHeader2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.SLATE_HEADER } };

    const kpiData = [
      ["Gross Payments Collected", grossPayments, "Total Reservations Count", params.reservations.length],
      ["Manual Refunds Issued", totalRefunds, "Total Guest Nights Booked", totalNights],
      ["Net Revenue Collected", netRevenue, "Total Registered Campers", params.guests.length],
      ["Gross Billed Booking Value", totalBookingsValue, "Total Tax Liability Collected", totalTaxCollected],
      ["Outstanding Guest Balances", totalBalanceDue, "Completed Ledger Transactions", params.payments.length],
    ];

    kpiData.forEach((row) => {
      const r = sheet.addRow([row[0], row[1], "", row[2], row[3], ""]);
      r.height = 22;

      // Style currency columns
      const cellB = r.getCell(2);
      cellB.numFmt = '"$"#,##0.00';
      cellB.font = { name: "Segoe UI", size: 11, bold: true };
      cellB.alignment = { horizontal: "right" };

      const cellE = r.getCell(5);
      if (typeof row[3] === "number" && (row[2] as string).includes("Tax")) {
        cellE.numFmt = '"$"#,##0.00';
      } else {
        cellE.numFmt = "#,##0";
      }
      cellE.font = { name: "Segoe UI", size: 11, bold: true };
      cellE.alignment = { horizontal: "right" };
    });

    sheet.addRow([]); // Blank line

    // Payment Method Breakdown Table
    const pmHeaderRow = sheet.addRow(["REVENUE BREAKDOWN BY PAYMENT METHOD"]);
    sheet.mergeCells(`A${pmHeaderRow.number}:C${pmHeaderRow.number}`);
    const pmHeader = sheet.getCell(`A${pmHeaderRow.number}`);
    pmHeader.value = "REVENUE BREAKDOWN BY PAYMENT METHOD";
    pmHeader.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    pmHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.SLATE_HEADER } };
    pmHeaderRow.height = 24;

    const methodRowHeader = sheet.addRow(["Payment Method", "Transactions Count", "Amount Collected"]);
    methodRowHeader.font = { bold: true };
    methodRowHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.SLATE_LIGHT } };

    const methodMap: Record<string, { count: number; amount: number }> = {};
    params.payments.forEach((p) => {
      if (p.status === "completed") {
        const m = p.method || "other";
        if (!methodMap[m]) methodMap[m] = { count: 0, amount: 0 };
        methodMap[m].count += 1;
        methodMap[m].amount += p.type === "refund" ? -p.amount : p.amount;
      }
    });

    Object.entries(methodMap).forEach(([method, data]) => {
      const r = sheet.addRow([
        method.toUpperCase().replace("_", " "),
        data.count,
        data.amount,
      ]);
      r.getCell(2).numFmt = "#,##0";
      r.getCell(3).numFmt = '"$"#,##0.00';
      r.getCell(3).font = { bold: true };
    });

    this.autofitColumns(sheet, 16);
  }

  /**
   * Bookings & Occupancy Worksheet
   */
  private static addBookingsSheet(
    workbook: ExcelJS.Workbook,
    reservations: any[],
    propertyName?: string,
    dateRangeText?: string
  ) {
    const sheet = workbook.addWorksheet("Bookings & Occupancy", {
      views: [{ showGridLines: true }],
    });

    let startRow = 1;
    if (propertyName) {
      sheet.mergeCells("A1:V1");
      const banner = sheet.getCell("A1");
      banner.value = `${propertyName.toUpperCase()} — BOOKINGS & OCCUPANCY REPORT (${dateRangeText || "All Time"})`;
      banner.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.BRAND_EMERALD } };
      banner.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).height = 30;
      sheet.addRow([]);
      startRow = 3;
    }

    const columns = [
      { header: "Confirmation #", key: "code", width: 16 },
      { header: "Guest Name", key: "guestName", width: 22 },
      { header: "Guest Email", key: "guestEmail", width: 24 },
      { header: "Guest Phone", key: "guestPhone", width: 16 },
      { header: "Site #", key: "siteNumber", width: 10 },
      { header: "Site Category", key: "siteType", width: 18 },
      { header: "Hookups", key: "hookups", width: 14 },
      { header: "Rig Type", key: "rigType", width: 16 },
      { header: "Check-In Date", key: "checkIn", width: 14 },
      { header: "Check-Out Date", key: "checkOut", width: 14 },
      { header: "Nights", key: "nights", width: 10 },
      { header: "Adults", key: "adults", width: 8 },
      { header: "Status", key: "status", width: 14 },
      { header: "Nightly Rate", key: "nightlyRate", width: 14 },
      { header: "Lodging Subtotal", key: "baseSubtotal", width: 16 },
      { header: "Add-Ons Subtotal", key: "addOnsSubtotal", width: 16 },
      { header: "Discount Amount", key: "discountAmount", width: 16 },
      { header: "Lodging Tax", key: "taxAmount", width: 14 },
      { header: "Total Amount", key: "totalAmount", width: 16 },
      { header: "Paid Amount", key: "paidAmount", width: 16 },
      { header: "Balance Due", key: "balanceDue", width: 16 },
      { header: "Booked On", key: "createdAt", width: 18 },
    ];

    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = STYLES.header.font;
      cell.fill = STYLES.header.fill;
      cell.alignment = STYLES.header.alignment;
      cell.border = STYLES.header.border;
    });

    const dataStartRowIndex = headerRow.number + 1;

    reservations.forEach((r, idx) => {
      const hookupStr = r.siteSnapshot?.hookups
        ? `${r.siteSnapshot.hookups.electric || "30A"}${r.siteSnapshot.hookups.water ? "/W" : ""}${
            r.siteSnapshot.hookups.sewer ? "/S" : ""
          }`
        : "Standard";

      const checkInStr = r.checkInDate ? new Date(r.checkInDate).toISOString().split("T")[0] : "—";
      const checkOutStr = r.checkOutDate ? new Date(r.checkOutDate).toISOString().split("T")[0] : "—";
      const createdStr = r.createdAt ? new Date(r.createdAt).toISOString().replace("T", " ").substring(0, 16) : "—";

      const pricing = r.pricing || {};

      const row = sheet.addRow([
        r.confirmationCode || "—",
        r.guestSnapshot?.fullName || "—",
        r.guestSnapshot?.email || "—",
        r.guestSnapshot?.phone || "—",
        r.siteSnapshot?.siteNumber || "—",
        r.siteSnapshot?.siteTypeName || "Standard",
        hookupStr,
        (r.guestSnapshot?.rvType || r.siteSnapshot?.rigType || "—").replace("_", " "),
        checkInStr,
        checkOutStr,
        r.numNights || 1,
        r.adults || 1,
        (r.status || "confirmed").toUpperCase(),
        pricing.nightlyRate || 0,
        pricing.baseSubtotal || 0,
        pricing.addOnsSubtotal || 0,
        pricing.discountAmount || 0,
        pricing.taxAmount || 0,
        pricing.totalAmount || 0,
        pricing.paidAmount || 0,
        pricing.balanceDue || 0,
        createdStr,
      ]);

      row.height = 20;

      // Apply borders and alternating background
      const isAlt = idx % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = STYLES.cellBorder;
        if (isAlt) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.SLATE_LIGHT },
          };
        }

        // Alignments & Number formats
        if (colNumber === 1 || colNumber === 5) {
          cell.alignment = { horizontal: "center" };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.BRAND_EMERALD } };
        } else if (colNumber === 9 || colNumber === 10 || colNumber === 22) {
          cell.alignment = { horizontal: "center" };
        } else if (colNumber === 11 || colNumber === 12) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 13) {
          cell.alignment = { horizontal: "center" };
          cell.font = { name: "Segoe UI", size: 9, bold: true };
        } else if (colNumber >= 14 && colNumber <= 21) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = '"$"#,##0.00';
          if (colNumber === 19) {
            cell.font = { name: "Segoe UI", size: 10, bold: true };
          } else if (colNumber === 21 && (pricing.balanceDue || 0) > 0) {
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.DANGER_RED } };
          }
        }
      });
    });

    const dataEndRowIndex = sheet.rowCount;

    // Add Totals Summary Row
    if (reservations.length > 0) {
      const totalRow = sheet.addRow([
        "TOTALS",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        { formula: `SUM(K${dataStartRowIndex}:K${dataEndRowIndex})` }, // Nights
        { formula: `SUM(L${dataStartRowIndex}:L${dataEndRowIndex})` }, // Adults
        "",
        "",
        { formula: `SUM(O${dataStartRowIndex}:O${dataEndRowIndex})` }, // Base Subtotal
        { formula: `SUM(P${dataStartRowIndex}:P${dataEndRowIndex})` }, // AddOns
        { formula: `SUM(Q${dataStartRowIndex}:Q${dataEndRowIndex})` }, // Discount
        { formula: `SUM(R${dataStartRowIndex}:R${dataEndRowIndex})` }, // Tax
        { formula: `SUM(S${dataStartRowIndex}:S${dataEndRowIndex})` }, // Total
        { formula: `SUM(T${dataStartRowIndex}:T${dataEndRowIndex})` }, // Paid
        { formula: `SUM(U${dataStartRowIndex}:U${dataEndRowIndex})` }, // Balance Due
        "",
      ]);

      totalRow.height = 24;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = STYLES.totalRow.font;
        cell.fill = STYLES.totalRow.fill;
        cell.border = STYLES.totalRow.border;

        if (colNumber === 11 || colNumber === 12) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        } else if (colNumber >= 15 && colNumber <= 21) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    this.autofitColumns(sheet, 12);
  }

  /**
   * Payment Transactions Ledger Worksheet
   */
  private static addPaymentsSheet(
    workbook: ExcelJS.Workbook,
    payments: any[],
    propertyName?: string,
    dateRangeText?: string
  ) {
    const sheet = workbook.addWorksheet("Payment Transactions Ledger", {
      views: [{ showGridLines: true }],
    });

    if (propertyName) {
      sheet.mergeCells("A1:K1");
      const banner = sheet.getCell("A1");
      banner.value = `${propertyName.toUpperCase()} — PAYMENT TRANSACTIONS & LEDGER (${dateRangeText || "All Time"})`;
      banner.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.BRAND_EMERALD } };
      banner.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).height = 30;
      sheet.addRow([]);
    }

    const columns = [
      { header: "Transaction Date & Time", width: 22 },
      { header: "Confirmation #", width: 16 },
      { header: "Guest Name", width: 22 },
      { header: "Guest Email", width: 24 },
      { header: "Type", width: 12 },
      { header: "Payment Method", width: 18 },
      { header: "Transaction Reference", width: 22 },
      { header: "Status", width: 12 },
      { header: "Amount ($)", width: 16 },
      { header: "Staff / Processed By", width: 18 },
      { header: "Notes & Memo", width: 28 },
    ];

    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = STYLES.header.font;
      cell.fill = STYLES.header.fill;
      cell.alignment = STYLES.header.alignment;
      cell.border = STYLES.header.border;
    });

    const dataStartRowIndex = headerRow.number + 1;

    payments.forEach((p, idx) => {
      const isRefund = p.type === "refund";
      const amountVal = isRefund ? -Math.abs(p.amount || 0) : Math.abs(p.amount || 0);
      const dateStr = p.createdAt ? new Date(p.createdAt).toISOString().replace("T", " ").substring(0, 19) : "—";
      const guestName = p.guestId ? `${p.guestId.firstName || ""} ${p.guestId.lastName || ""}`.trim() : "—";
      const confirmationCode = p.reservationId?.confirmationCode || "—";

      const row = sheet.addRow([
        dateStr,
        confirmationCode,
        guestName || "Guest",
        p.guestId?.email || "—",
        isRefund ? "REFUND" : "PAYMENT",
        (p.method || "credit_card").toUpperCase().replace("_", " "),
        p.transactionReference || "—",
        (p.status || "completed").toUpperCase(),
        amountVal,
        p.processedByUserId?.name || "Front Desk Staff",
        p.notes || "",
      ]);

      row.height = 20;
      const isAlt = idx % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = STYLES.cellBorder;
        if (isAlt) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.SLATE_LIGHT },
          };
        }

        if (colNumber === 1 || colNumber === 7) {
          cell.alignment = { horizontal: "center" };
        } else if (colNumber === 2) {
          cell.alignment = { horizontal: "center" };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.BRAND_EMERALD } };
        } else if (colNumber === 5) {
          cell.alignment = { horizontal: "center" };
          cell.font = {
            name: "Segoe UI",
            size: 9,
            bold: true,
            color: { argb: isRefund ? COLORS.DANGER_RED : COLORS.SUCCESS_GREEN },
          };
        } else if (colNumber === 6 || colNumber === 8) {
          cell.alignment = { horizontal: "center" };
        } else if (colNumber === 9) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
          cell.font = {
            name: "Segoe UI",
            size: 10,
            bold: true,
            color: { argb: isRefund ? COLORS.DANGER_RED : COLORS.SUCCESS_GREEN },
          };
        }
      });
    });

    const dataEndRowIndex = sheet.rowCount;

    if (payments.length > 0) {
      const totalRow = sheet.addRow([
        "NET COLLECTED TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        { formula: `SUM(I${dataStartRowIndex}:I${dataEndRowIndex})` },
        "",
        "",
      ]);

      totalRow.height = 24;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = STYLES.totalRow.font;
        cell.fill = STYLES.totalRow.fill;
        cell.border = STYLES.totalRow.border;

        if (colNumber === 9) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    this.autofitColumns(sheet, 14);
  }

  /**
   * Invoices & Tax Liability Audit Worksheet
   */
  private static addInvoicesTaxSheet(
    workbook: ExcelJS.Workbook,
    reservations: any[],
    propertySettings?: any,
    propertyName?: string,
    dateRangeText?: string
  ) {
    const sheet = workbook.addWorksheet("Invoices & Tax Audit", {
      views: [{ showGridLines: true }],
    });

    if (propertyName) {
      sheet.mergeCells("A1:N1");
      const banner = sheet.getCell("A1");
      banner.value = `${propertyName.toUpperCase()} — INVOICES & LODGING TAX AUDIT (${dateRangeText || "All Time"})`;
      banner.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.BRAND_EMERALD } };
      banner.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).height = 30;
      sheet.addRow([]);
    }

    const defaultTaxRate = propertySettings?.taxRatePercent || 7.5;

    const columns = [
      { header: "Invoice / Folio #", width: 16 },
      { header: "Issue Date", width: 14 },
      { header: "Guest Name", width: 22 },
      { header: "Site Assigned", width: 14 },
      { header: "Nights", width: 10 },
      { header: "Lodging Subtotal", width: 16 },
      { header: "Taxable Add-Ons", width: 16 },
      { header: "Non-Taxable Add-Ons", width: 18 },
      { header: "Discounts Applied", width: 16 },
      { header: "Lodging Tax Rate (%)", width: 18 },
      { header: "Tax Amount Collected", width: 18 },
      { header: "Gross Billed Total", width: 16 },
      { header: "Total Paid", width: 16 },
      { header: "Balance Outstanding", width: 18 },
    ];

    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = STYLES.header.font;
      cell.fill = STYLES.header.fill;
      cell.alignment = STYLES.header.alignment;
      cell.border = STYLES.header.border;
    });

    const dataStartRowIndex = headerRow.number + 1;

    reservations.forEach((r, idx) => {
      const pricing = r.pricing || {};
      const addOns = r.addOns || [];

      const taxableAddOns = addOns
        .filter((a: any) => a.taxable !== false)
        .reduce((sum: number, a: any) => sum + (a.subtotal || 0), 0);

      const nonTaxableAddOns = addOns
        .filter((a: any) => a.taxable === false)
        .reduce((sum: number, a: any) => sum + (a.subtotal || 0), 0);

      const taxableBase = Math.max(0, (pricing.baseSubtotal || 0) - (pricing.discountAmount || 0)) + taxableAddOns;
      const effectiveTaxRate = taxableBase > 0 && pricing.taxAmount > 0
        ? Number(((pricing.taxAmount / taxableBase) * 100).toFixed(2))
        : defaultTaxRate;

      const issueDateStr = r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "—";

      const row = sheet.addRow([
        r.confirmationCode || "—",
        issueDateStr,
        r.guestSnapshot?.fullName || "—",
        `Site ${r.siteSnapshot?.siteNumber || "—"}`,
        r.numNights || 1,
        pricing.baseSubtotal || 0,
        taxableAddOns,
        nonTaxableAddOns,
        pricing.discountAmount || 0,
        effectiveTaxRate / 100, // For Excel percentage format
        pricing.taxAmount || 0,
        pricing.totalAmount || 0,
        pricing.paidAmount || 0,
        pricing.balanceDue || 0,
      ]);

      row.height = 20;
      const isAlt = idx % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = STYLES.cellBorder;
        if (isAlt) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.SLATE_LIGHT },
          };
        }

        if (colNumber === 1 || colNumber === 2 || colNumber === 4) {
          cell.alignment = { horizontal: "center" };
          if (colNumber === 1) {
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.BRAND_EMERALD } };
          }
        } else if (colNumber === 5) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 10) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "0.0%";
        } else if (colNumber >= 6 && colNumber <= 14) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = '"$"#,##0.00';
          if (colNumber === 11) {
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.BRAND_DARK } };
          } else if (colNumber === 12) {
            cell.font = { name: "Segoe UI", size: 10, bold: true };
          } else if (colNumber === 14 && (pricing.balanceDue || 0) > 0) {
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.DANGER_RED } };
          }
        }
      });
    });

    const dataEndRowIndex = sheet.rowCount;

    if (reservations.length > 0) {
      const totalRow = sheet.addRow([
        "TOTAL TAX LIABILITY",
        "",
        "",
        "",
        { formula: `SUM(E${dataStartRowIndex}:E${dataEndRowIndex})` },
        { formula: `SUM(F${dataStartRowIndex}:F${dataEndRowIndex})` },
        { formula: `SUM(G${dataStartRowIndex}:G${dataEndRowIndex})` },
        { formula: `SUM(H${dataStartRowIndex}:H${dataEndRowIndex})` },
        { formula: `SUM(I${dataStartRowIndex}:I${dataEndRowIndex})` },
        "",
        { formula: `SUM(K${dataStartRowIndex}:K${dataEndRowIndex})` }, // Total Tax
        { formula: `SUM(L${dataStartRowIndex}:L${dataEndRowIndex})` }, // Gross Billed
        { formula: `SUM(M${dataStartRowIndex}:M${dataEndRowIndex})` }, // Total Paid
        { formula: `SUM(N${dataStartRowIndex}:N${dataEndRowIndex})` }, // Balance
      ]);

      totalRow.height = 24;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = STYLES.totalRow.font;
        cell.fill = STYLES.totalRow.fill;
        cell.border = STYLES.totalRow.border;

        if (colNumber === 5) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        } else if (colNumber >= 6 && colNumber <= 14 && colNumber !== 10) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    this.autofitColumns(sheet, 14);
  }

  /**
   * Guest CRM Directory Worksheet
   */
  private static addGuestsSheet(workbook: ExcelJS.Workbook, guests: any[], propertyName?: string) {
    const sheet = workbook.addWorksheet("Guest CRM Directory", {
      views: [{ showGridLines: true }],
    });

    if (propertyName) {
      sheet.mergeCells("A1:M1");
      const banner = sheet.getCell("A1");
      banner.value = `${propertyName.toUpperCase()} — GUEST CRM DIRECTORY & CAMPER ROSTER`;
      banner.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.BRAND_EMERALD } };
      banner.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(1).height = 30;
      sheet.addRow([]);
    }

    const columns = [
      { header: "Guest ID", width: 14 },
      { header: "Full Name", width: 22 },
      { header: "Email Address", width: 26 },
      { header: "Phone Number", width: 16 },
      { header: "City & State", width: 18 },
      { header: "RV Type", width: 16 },
      { header: "Length (ft)", width: 12 },
      { header: "License Plate", width: 14 },
      { header: "VIP Status", width: 12 },
      { header: "Total Stays", width: 12 },
      { header: "Lifetime Spend ($)", width: 18 },
      { header: "Registered Date", width: 16 },
      { header: "Staff Notes", width: 28 },
    ];

    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = STYLES.header.font;
      cell.fill = STYLES.header.fill;
      cell.alignment = STYLES.header.alignment;
      cell.border = STYLES.header.border;
    });

    const dataStartRowIndex = headerRow.number + 1;

    guests.forEach((g, idx) => {
      const cityState = [g.address?.city, g.address?.state].filter(Boolean).join(", ") || "—";
      const createdStr = g.createdAt ? new Date(g.createdAt).toISOString().split("T")[0] : "—";

      const row = sheet.addRow([
        g._id?.toString().substring(18) || "—",
        `${g.firstName || ""} ${g.lastName || ""}`.trim(),
        g.email || "—",
        g.phone || "—",
        cityState,
        (g.rvDetails?.type || "travel_trailer").replace("_", " "),
        g.rvDetails?.lengthFt || 0,
        g.rvDetails?.licensePlate || "—",
        g.isVip ? "VIP CAMPER" : "STANDARD",
        g.totalStays || 0,
        g.totalSpent || 0,
        createdStr,
        g.notes || "",
      ]);

      row.height = 20;
      const isAlt = idx % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = STYLES.cellBorder;
        if (isAlt) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.SLATE_LIGHT },
          };
        }

        if (colNumber === 1 || colNumber === 7 || colNumber === 8 || colNumber === 12) {
          cell.alignment = { horizontal: "center" };
        } else if (colNumber === 9) {
          cell.alignment = { horizontal: "center" };
          if (g.isVip) {
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: COLORS.BRAND_EMERALD } };
          }
        } else if (colNumber === 10) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 11) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = '"$"#,##0.00';
          cell.font = { name: "Segoe UI", size: 10, bold: true };
        }
      });
    });

    const dataEndRowIndex = sheet.rowCount;

    if (guests.length > 0) {
      const totalRow = sheet.addRow([
        "TOTALS",
        `${guests.length} Registered Guests`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        { formula: `SUM(J${dataStartRowIndex}:J${dataEndRowIndex})` }, // Total Stays
        { formula: `SUM(K${dataStartRowIndex}:K${dataEndRowIndex})` }, // Total Spend
        "",
        "",
      ]);

      totalRow.height = 24;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = STYLES.totalRow.font;
        cell.fill = STYLES.totalRow.fill;
        cell.border = STYLES.totalRow.border;

        if (colNumber === 10) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        } else if (colNumber === 11) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    }

    this.autofitColumns(sheet, 14);
  }
}
