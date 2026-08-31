import { formatCurrency, formatDate } from "@/lib/utils/format";

const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  line-height: 1.5;
  margin: 0;
  padding: 0;
  background-color: #f8fafc;
`;

const CONTAINER_STYLES = `
  max-width: 600px;
  margin: 20px auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`;

const HEADER_STYLES = `
  background-color: #059669;
  color: #ffffff;
  padding: 24px 30px;
  text-align: left;
`;

const FOOTER_STYLES = `
  padding: 20px 30px;
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
  color: #64748b;
  text-align: center;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #059669;
  color: #ffffff !important;
  font-weight: 700;
  font-size: 14px;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  margin-top: 16px;
`;

/**
 * 1. User Login Alert Template
 */
export function loginNotificationTemplate(data: {
  userName: string;
  email: string;
  loginTime: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">CampFlow</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Account Security Notification</p>
          </div>
          <div style="padding: 28px 30px;">
            <h2 style="font-size:18px;margin-top:0;color:#0f172a;">New Login Detected</h2>
            <p style="font-size:14px;color:#334155;">Hello <strong>${data.userName}</strong>,</p>
            <p style="font-size:14px;color:#334155;">
              We noticed a successful sign-in to your CampFlow account for <strong>${data.email}</strong>.
            </p>

            <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px;margin:20px 0;font-size:13px;color:#334155;">
              <div style="margin-bottom:6px;"><strong>Time:</strong> ${data.loginTime}</div>
              ${data.ipAddress ? `<div style="margin-bottom:6px;"><strong>IP Address:</strong> ${data.ipAddress}</div>` : ""}
              ${data.userAgent ? `<div><strong>Client / Device:</strong> ${data.userAgent}</div>` : ""}
            </div>

            <p style="font-size:13px;color:#64748b;">
              If this was you, no action is needed. If you did not log in, please contact your park administrator immediately.
            </p>

            <div style="text-align:center;margin-top:24px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard" style="${BUTTON_STYLES}">Go to Front Desk Dashboard</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin:0;">CampFlow RV Resort & Campground Management System</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 2. User Registration Welcome Template
 */
export function welcomeRegistrationTemplate(data: {
  userName: string;
  organizationName: string;
  propertyName: string;
  email: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">CampFlow</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Welcome to Independent Campground Management</p>
          </div>
          <div style="padding: 28px 30px;">
            <h2 style="font-size:20px;margin-top:0;color:#0f172a;">Welcome to CampFlow, ${data.userName}!</h2>
            <p style="font-size:14px;color:#334155;">
              Your campground organization <strong>${data.organizationName}</strong> and park <strong>${data.propertyName}</strong> have been successfully configured.
            </p>

            <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <h3 style="margin:0 0 10px;font-size:14px;color:#065f46;font-weight:700;">🚀 Quick Start Checklist:</h3>
              <ul style="margin:0;padding-left:20px;font-size:13px;color:#047857;line-height:1.7;">
                <li>Explore the <strong>Interactive Tape Chart</strong> for visual drag-and-drop bookings.</li>
                <li>Configure your <strong>Campsites, Hookups, and Base Rates</strong> in Sites & Map.</li>
                <li>Set up <strong>Add-On Services</strong> (Firewood, Propane, Golf Carts) in Services.</li>
                <li>Share your public booking link with campers: <code>/book/...</code></li>
              </ul>
            </div>

            <div style="text-align:center;margin-top:24px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard" style="${BUTTON_STYLES}">Open Front Desk Portal</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin:0;">CampFlow SaaS • Helping Campgrounds Thrive</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 3. Booking Confirmation Template
 */
export function bookingConfirmationTemplate(data: {
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
  const checkInFormatted = formatDate(data.checkInDate);
  const checkOutFormatted = formatDate(data.checkOutDate);
  const passUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/book/${
    data.slug || "campflow-rv-resort"
  }/confirmation/${data.confirmationCode}`;

  return `
    <!DOCTYPE html>
    <html>
      <body style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h1 style="margin:0;font-size:22px;font-weight:800;">${data.propertyName}</h1>
                <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Reservation Confirmation</p>
              </div>
            </div>
          </div>

          <div style="padding: 28px 30px;">
            <div style="text-align:center;background-color:#ecfdf5;border:2px dashed #059669;border-radius:8px;padding:16px;margin-bottom:24px;">
              <span style="font-size:11px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:1px;display:block;">Your Confirmation Code</span>
              <span style="font-size:26px;font-weight:900;font-family:monospace;color:#065f46;letter-spacing:2px;">${data.confirmationCode}</span>
            </div>

            <p style="font-size:14px;color:#334155;">Hello <strong>${data.guestName}</strong>,</p>
            <p style="font-size:14px;color:#334155;">
              We look forward to welcoming you to <strong>${data.propertyName}</strong>! Below are the details of your upcoming stay.
            </p>

            <!-- Stay Summary Box -->
            <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin:20px 0;font-size:13px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;width:40%;"><strong>Assigned Site:</strong></td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:700;">Site ${data.siteNumber} (${data.siteTypeName})</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;"><strong>Check-In Date:</strong></td>
                  <td style="padding:6px 0;color:#0f172a;">${checkInFormatted} (After 1:00 PM)</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;"><strong>Check-Out Date:</strong></td>
                  <td style="padding:6px 0;color:#0f172a;">${checkOutFormatted} (Before 11:00 AM)</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;"><strong>Duration & Occupancy:</strong></td>
                  <td style="padding:6px 0;color:#0f172a;">${data.numNights} Night${data.numNights > 1 ? "s" : ""} • ${data.adults} Adults, ${data.children} Children, ${data.pets} Pets</td>
                </tr>
              </table>
            </div>

            <!-- Itemized Add-Ons if any -->
            ${
              data.addOns && data.addOns.length > 0
                ? `
                <div style="margin:20px 0;">
                  <h3 style="font-size:14px;color:#0f172a;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Add-On Services & Amenities:</h3>
                  <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    ${data.addOns
                      .map(
                        (item) => `
                      <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:8px 0;color:#334155;">${item.name} <span style="color:#64748b;">(x${item.quantity})</span></td>
                        <td style="padding:8px 0;text-align:right;font-family:monospace;font-weight:700;color:#0f172a;">${formatCurrency(item.subtotal)}</td>
                      </tr>
                    `
                      )
                      .join("")}
                  </table>
                </div>
              `
                : ""
            }

            <!-- Financial Summary Table -->
            <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;font-size:13px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:4px 0;color:#64748b;">Lodging Subtotal:</td>
                  <td style="padding:4px 0;text-align:right;font-family:monospace;">${formatCurrency(data.pricing.baseSubtotal)}</td>
                </tr>
                ${
                  data.pricing.addOnsSubtotal && data.pricing.addOnsSubtotal > 0
                    ? `<tr>
                        <td style="padding:4px 0;color:#065f46;font-weight:600;">Add-On Services:</td>
                        <td style="padding:4px 0;text-align:right;font-family:monospace;font-weight:700;color:#065f46;">+${formatCurrency(data.pricing.addOnsSubtotal)}</td>
                      </tr>`
                    : ""
                }
                <tr>
                  <td style="padding:4px 0;color:#64748b;">Taxes & Resort Fees:</td>
                  <td style="padding:4px 0;text-align:right;font-family:monospace;">+${formatCurrency(data.pricing.taxAmount)}</td>
                </tr>
                <tr style="border-top:1px solid #e2e8f0;font-weight:800;font-size:14px;">
                  <td style="padding:8px 0;color:#0f172a;">Total Stay Amount:</td>
                  <td style="padding:8px 0;text-align:right;font-family:monospace;color:#0f172a;">${formatCurrency(data.pricing.totalAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#059669;font-weight:700;">Paid to Date:</td>
                  <td style="padding:4px 0;text-align:right;font-family:monospace;color:#059669;font-weight:700;">${formatCurrency(data.pricing.paidAmount)}</td>
                </tr>
                ${
                  data.pricing.balanceDue > 0
                    ? `<tr>
                        <td style="padding:4px 0;color:#dc2626;font-weight:800;">Balance Due upon Arrival:</td>
                        <td style="padding:4px 0;text-align:right;font-family:monospace;color:#dc2626;font-weight:800;">${formatCurrency(data.pricing.balanceDue)}</td>
                      </tr>`
                    : ""
                }
              </table>
            </div>

            <div style="text-align:center;margin-top:24px;">
              <a href="${passUrl}" style="${BUTTON_STYLES}">View & Print Reservation Pass</a>
            </div>

            ${
              data.propertyAddress
                ? `
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
                <strong>Campground Address:</strong> ${data.propertyAddress}
                ${data.propertyPhone ? `<br /><strong>Phone:</strong> ${data.propertyPhone}` : ""}
                ${data.propertyEmail ? `<br /><strong>Email:</strong> ${data.propertyEmail}` : ""}
              </div>
            `
                : ""
            }
          </div>

          <div style="${FOOTER_STYLES}">
            <p style="margin:0;">Thank you for choosing ${data.propertyName} • Powered by CampFlow</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 4. Mass Camper Announcement Template
 */
export function massAnnouncementTemplate(data: {
  propertyName: string;
  subject: string;
  messageBody: string;
  priority: "general" | "event" | "urgent" | "weather_alert";
  propertyPhone?: string;
  propertyEmail?: string;
}) {
  let badgeColor = "#059669";
  let badgeText = "Park Announcement";

  if (data.priority === "weather_alert") {
    badgeColor = "#dc2626";
    badgeText = "⚠️ Weather Alert / Safety Notice";
  } else if (data.priority === "urgent") {
    badgeColor = "#ea580c";
    badgeText = "Important Park Notice";
  } else if (data.priority === "event") {
    badgeColor = "#7c3aed";
    badgeText = "🎉 Campground Event & Activities";
  }

  // Format line breaks
  const formattedBody = data.messageBody
    .split("\n")
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6;">${p}</p>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <body style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <h1 style="margin:0;font-size:22px;font-weight:800;">${data.propertyName}</h1>
            <span style="display:inline-block;background-color:${badgeColor};color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">${badgeText}</span>
          </div>

          <div style="padding: 28px 30px;">
            <h2 style="font-size:20px;margin-top:0;margin-bottom:16px;color:#0f172a;">${data.subject}</h2>

            <div style="font-size:14px;color:#334155;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
              ${formattedBody}
            </div>

            <p style="font-size:13px;color:#64748b;">
              Have questions or need assistance? Please visit the Front Desk or contact our park staff.
            </p>

            ${
              data.propertyPhone || data.propertyEmail
                ? `
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
                ${data.propertyPhone ? `<strong>Office Phone:</strong> ${data.propertyPhone}` : ""}
                ${data.propertyEmail ? ` &bull; <strong>Email:</strong> ${data.propertyEmail}` : ""}
              </div>
            `
                : ""
            }
          </div>

          <div style="${FOOTER_STYLES}">
            <p style="margin:0;">CampFlow Mass Messaging System • ${data.propertyName}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 5. Automated Scheduled Export Report Template
 */
export function scheduledExportReportTemplate(data: {
  propertyName: string;
  scheduleName: string;
  reportTypeName: string;
  frequency: string;
  dateRangeText: string;
  recordsCount: number;
  fileSizeBytes: number;
  fileName: string;
  summaryMetrics?: {
    totalRevenue?: number;
    totalTransactions?: number;
    totalBookings?: number;
  };
}) {
  const sizeKb = (data.fileSizeBytes / 1024).toFixed(1);

  return `
    <!DOCTYPE html>
    <html>
      <body style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;opacity:0.9;">CampFlow Automated Accounting</div>
            <h1 style="margin:4px 0 0 0;font-size:22px;font-weight:800;">${data.propertyName}</h1>
          </div>

          <div style="padding: 28px 30px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span style="display:inline-block;background-color:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;">
                ${data.frequency} Automated Schedule
              </span>
            </div>

            <h2 style="font-size:19px;margin-top:0;margin-bottom:8px;color:#0f172a;">${data.scheduleName}</h2>
            <p style="font-size:13px;color:#64748b;margin-top:0;margin-bottom:20px;">
              Attached is your scheduled <strong>${data.reportTypeName}</strong> for the period <strong>${data.dateRangeText}</strong>.
            </p>

            <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:10px;">Export Summary</div>
              
              <table style="width:100%;font-size:13px;border-collapse:collapse;">
                <tr>
                  <td style="padding:4px 0;color:#64748b;">Report Format:</td>
                  <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">Microsoft Excel (.xlsx)</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#64748b;">Total Records:</td>
                  <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${data.recordsCount} rows</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#64748b;">File Size:</td>
                  <td style="padding:4px 0;text-align:right;font-mono;font-weight:600;color:#0f172a;">${sizeKb} KB</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#64748b;">File Name:</td>
                  <td style="padding:4px 0;text-align:right;font-family:monospace;font-size:11px;color:#047857;font-weight:700;">${data.fileName}</td>
                </tr>
                ${
                  data.summaryMetrics?.totalRevenue !== undefined
                    ? `
                <tr style="border-top:1px dashed #cbd5e1;">
                  <td style="padding:8px 0 4px 0;color:#0f172a;font-weight:700;">Total Revenue:</td>
                  <td style="padding:8px 0 4px 0;text-align:right;font-weight:800;font-size:15px;color:#047857;">${formatCurrency(data.summaryMetrics.totalRevenue)}</td>
                </tr>
                `
                    : ""
                }
              </table>
            </div>

            <p style="font-size:12px;color:#94a3b8;line-height:1.5;">
              📎 The Excel workbook is attached to this email. You can open it in Microsoft Excel, Google Sheets, or Apple Numbers. You can also review past exports anytime in your CampFlow Dashboard under <strong>Exports & Reports</strong>.
            </p>
          </div>

          <div style="${FOOTER_STYLES}">
            <p style="margin:0;">CampFlow Campground Management Systems • ${data.propertyName}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

