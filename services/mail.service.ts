import { sendEmail } from "@/lib/mail/resend";
import {
  loginNotificationTemplate,
  welcomeRegistrationTemplate,
  bookingConfirmationTemplate,
  massAnnouncementTemplate,
  scheduledExportReportTemplate,
} from "@/lib/mail/templates";

export class MailService {
  /**
   * 1. Send Login Security Alert
   */
  static async sendLoginAlert(params: {
    to: string;
    userName: string;
    loginTime?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const html = loginNotificationTemplate({
      userName: params.userName,
      email: params.to,
      loginTime: params.loginTime || new Date().toLocaleString(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return sendEmail({
      to: params.to,
      subject: "🔒 Security Alert: New Sign-in to CampFlow",
      html,
    });
  }

  /**
   * 2. Send Registration Welcome Email
   */
  static async sendRegistrationWelcome(params: {
    to: string;
    userName: string;
    organizationName: string;
    propertyName: string;
  }) {
    const html = welcomeRegistrationTemplate({
      userName: params.userName,
      organizationName: params.organizationName,
      propertyName: params.propertyName,
      email: params.to,
    });

    return sendEmail({
      to: params.to,
      subject: `🌲 Welcome to CampFlow, ${params.userName}! Your park is ready`,
      html,
    });
  }

  /**
   * 3. Send Booking Confirmation Email
   */
  static async sendBookingConfirmation(params: {
    to: string;
    confirmationCode: string;
    guestName: string;
    propertyName: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyAddress?: string;
    siteNumber: string;
    siteTypeName: string;
    checkInDate: string | Date;
    checkOutDate: string | Date;
    numNights: number;
    adults: number;
    children: number;
    pets: number;
    pricing: {
      nightlyRate: number;
      baseSubtotal: number;
      addOnsSubtotal?: number;
      taxAmount: number;
      totalAmount: number;
      paidAmount: number;
      balanceDue: number;
    };
    addOns?: Array<{
      name: string;
      quantity: number;
      subtotal: number;
      pricingType?: string;
    }>;
    slug?: string;
  }) {
    const html = bookingConfirmationTemplate({
      confirmationCode: params.confirmationCode,
      guestName: params.guestName,
      propertyName: params.propertyName,
      propertyPhone: params.propertyPhone,
      propertyEmail: params.propertyEmail,
      propertyAddress: params.propertyAddress,
      siteNumber: params.siteNumber,
      siteTypeName: params.siteTypeName,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      numNights: params.numNights,
      adults: params.adults,
      children: params.children,
      pets: params.pets,
      pricing: params.pricing,
      addOns: params.addOns,
      slug: params.slug,
    });

    return sendEmail({
      to: params.to,
      subject: `🏕️ Booking Confirmed: ${params.confirmationCode} at ${params.propertyName}`,
      html,
    });
  }

  /**
   * 4. Send Mass Broadcast Announcement to Campers
   */
  static async sendMassBroadcast(params: {
    recipients: string[];
    propertyName: string;
    subject: string;
    messageBody: string;
    priority: "general" | "event" | "urgent" | "weather_alert";
    propertyPhone?: string;
    propertyEmail?: string;
  }) {
    if (!params.recipients || params.recipients.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    const html = massAnnouncementTemplate({
      propertyName: params.propertyName,
      subject: params.subject,
      messageBody: params.messageBody,
      priority: params.priority,
      propertyPhone: params.propertyPhone,
      propertyEmail: params.propertyEmail,
    });

    let sentCount = 0;
    let failedCount = 0;

    // Send in chunks of 20 for rate limiting safety
    const chunkSize = 20;
    for (let i = 0; i < params.recipients.length; i += chunkSize) {
      const batch = params.recipients.slice(i, i + chunkSize);
      const promises = batch.map((email) =>
        sendEmail({
          to: email,
          subject: `${params.priority === "weather_alert" ? "⚠️ " : ""}${params.propertyName}: ${params.subject}`,
          html,
        })
      );

      const results = await Promise.allSettled(promises);
      results.forEach((res) => {
        if (res.status === "fulfilled" && res.value.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      });
    }

    return {
      success: sentCount > 0 || failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * 5. Send Scheduled Export Report with Excel Attachment
   */
  static async sendScheduledExportReport(params: {
    recipients: string[];
    propertyName: string;
    scheduleName: string;
    reportTypeName: string;
    frequency: string;
    dateRangeText: string;
    recordsCount: number;
    fileSizeBytes: number;
    fileName: string;
    fileBuffer: Buffer;
    summaryMetrics?: {
      totalRevenue?: number;
      totalTransactions?: number;
      totalBookings?: number;
    };
  }) {
    if (!params.recipients || params.recipients.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    const html = scheduledExportReportTemplate({
      propertyName: params.propertyName,
      scheduleName: params.scheduleName,
      reportTypeName: params.reportTypeName,
      frequency: params.frequency,
      dateRangeText: params.dateRangeText,
      recordsCount: params.recordsCount,
      fileSizeBytes: params.fileSizeBytes,
      fileName: params.fileName,
      summaryMetrics: params.summaryMetrics,
    });

    const attachments = [
      {
        filename: params.fileName,
        content: params.fileBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ];

    let sentCount = 0;
    let failedCount = 0;

    for (const email of params.recipients) {
      const result = await sendEmail({
        to: email,
        subject: `📊 [Scheduled Report] ${params.scheduleName} - ${params.propertyName}`,
        html,
        attachments,
      });

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return {
      success: sentCount > 0 || failedCount === 0,
      sentCount,
      failedCount,
    };
  }
}

