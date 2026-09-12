import type { NextRequest } from "next/server";
import { GET as enterpriseAuditExportGet } from "@/app/api/enterprise/audit/export/route";

export async function GET(request: NextRequest) {
	return enterpriseAuditExportGet(request);
}
