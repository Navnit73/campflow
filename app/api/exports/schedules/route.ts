import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { createScheduleSchema } from "@/lib/validations/export.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const schedules = await ExportService.listSchedules(
      session.organizationId,
      session.propertyId
    );

    return apiSuccess(schedules, "Export schedules loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createScheduleSchema.parse(body);

    const schedule = await ExportService.createSchedule(
      session.organizationId,
      session.propertyId,
      session.userId,
      validated
    );

    return apiSuccess(schedule, "Export schedule created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
