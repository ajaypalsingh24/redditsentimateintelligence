import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { generateReportExcel } from "@/lib/report-excel";
import { getBrandsWithMentions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reddit-report";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("project") || "";
  const scanId = request.nextUrl.searchParams.get("scan") || "";
  const brands = await getBrandsWithMentions();
  const brand = brands.find((item) => item.id === projectId) || brands[0];

  if (!brand) {
    return NextResponse.json({ error: "No project found" }, { status: 404 });
  }

  const scanRun = brand.scanRuns?.find((item) => item.id === scanId);
  const mentionIds = scanRun ? new Set(scanRun.mentionIds) : null;
  const mentions = mentionIds ? (brand.mentions || []).filter((mention) => mentionIds.has(mention.id)) : brand.mentions || [];
  const excel = await generateReportExcel({ brand, mentions, scanRun });

  return new NextResponse(excel, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(brand.name)}-reddit-sentiment-report.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
