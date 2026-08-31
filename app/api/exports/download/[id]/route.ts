import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const resolvedParams = await params;

    const result = await ExportService.downloadExportJob(
      session.organizationId,
      session.propertyId,
      resolvedParams.id
    );

    return new NextResponse(new Uint8Array(result.fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Content-Length": result.fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
