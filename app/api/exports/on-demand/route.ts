import { NextRequest, NextResponse } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { createOnDemandExportSchema } from "@/lib/validations/export.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const body = await req.json().catch(() => ({}));
    const validated = createOnDemandExportSchema.parse(body);

    const { searchParams } = new URL(req.url);
    const directDownload = searchParams.get("download") === "true";

    const result = await ExportService.generateOnDemandExport(
      session.organizationId,
      session.propertyId,
      session.userId,
      validated
    );

    // If client requested direct binary stream
    if (directDownload) {
      return new NextResponse(new Uint8Array(result.fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
          "Content-Length": result.fileBuffer.length.toString(),
        },
      });
    }

    // Default: return JSON payload with download URL and metadata
    return apiSuccess(
      {
        job: result.job,
        fileName: result.fileName,
        recordsCount: result.job.recordsCount,
        fileSizeBytes: result.job.fileSizeBytes,
        downloadUrl: `/api/exports/download/${result.job._id}`,
      },
      "Excel report generated successfully",
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
