import { NextRequest } from "next/server";
import { SeedService } from "@/services/seed.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const result = await SeedService.seedDemoData();
    return apiSuccess(result, "Database seeded with Pine Ridge RV Haven data");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await SeedService.seedDemoData();
    return apiSuccess(result, "Database seeded with Pine Ridge RV Haven data");
  } catch (error) {
    return handleApiError(error);
  }
}
