import ExcelJS from "exceljs";
import { actionPlan, actionRequired, overallInsight, sentimentBreakdown, sourceKeyword, subredditTargets, topThemes } from "@/lib/report";
import { BrandRecord, MentionRecord, ScanRunRecord } from "@/lib/store";

type ExcelInput = {
  brand: BrandRecord;
  mentions: MentionRecord[];
  scanRun?: ScanRunRecord;
};

function cleanSheetName(value: string) {
  return value.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
}

function dateLabel(value?: Date) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width || 16, 14), 54);
  });
}

function addRows(sheet: ExcelJS.Worksheet, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  sheet.columns = Object.keys(rows[0]).map((key) => ({
    header: key,
    key,
    width: Math.min(Math.max(key.length + 8, 16), 44),
  }));
  sheet.addRows(rows);
  styleSheet(sheet);
}

export async function generateReportExcel({ brand, mentions, scanRun }: ExcelInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "reddify.me";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sentimentMentions = mentions.filter((mention) => mention.isBrandMentioned !== false);
  const opportunityMentions = mentions.filter((mention) => mention.isBrandMentioned === false);
  const stats = sentimentBreakdown(sentimentMentions);

  addRows(workbook.addWorksheet("Overview"), [
    { Metric: "Brand", Value: brand.name },
    { Metric: "Website", Value: brand.website || "Not provided" },
    { Metric: "Client Email", Value: brand.clientEmail || "Not provided" },
    { Metric: "Scan Snapshot", Value: scanRun ? dateLabel(scanRun.scannedAt) : "All saved data" },
    { Metric: "Sentiment Score", Value: stats.total ? stats.sentimentScore : "NA" },
    { Metric: "Positive %", Value: `${stats.positivePct}%` },
    { Metric: "Neutral %", Value: `${stats.neutralPct}%` },
    { Metric: "Negative %", Value: `${stats.negativePct}%` },
    { Metric: "Brand Mentioned Threads", Value: stats.total },
    { Metric: "Opportunity Only Threads", Value: opportunityMentions.length },
    { Metric: "Overall Insight", Value: overallInsight(brand, sentimentMentions) },
  ]);

  addRows(
    workbook.addWorksheet("Sentiment Threads"),
    sentimentMentions.map((mention) => ({
      "Thread URL": mention.url,
      "Thread Title": mention.title,
      Subreddit: mention.subreddit || "Unknown",
      Sentiment: mention.sentiment,
      Confidence: `${mention.confidence}%`,
      "Risk Score": mention.riskScore,
      "Sentiment Summary": mention.reason || mention.snippet,
      "Action Required": actionRequired(mention),
      "Source Keyword": sourceKeyword(mention),
      "Detected At": dateLabel(mention.detectedAt),
    })),
  );

  addRows(
    workbook.addWorksheet("Opportunities"),
    opportunityMentions.map((mention) => ({
      "Thread URL": mention.url,
      "Thread Title": mention.title,
      Subreddit: mention.subreddit || "Unknown",
      "Source Keyword": sourceKeyword(mention),
      "Opportunity Summary": mention.reason || mention.snippet,
      "Action Required": actionRequired(mention),
      "Detected At": dateLabel(mention.detectedAt),
    })),
  );

  addRows(
    workbook.addWorksheet("Themes"),
    topThemes(sentimentMentions).map(([theme, count]) => ({
      Theme: theme,
      Count: count,
    })),
  );

  addRows(
    workbook.addWorksheet("Subreddits"),
    subredditTargets(brand, mentions).map((item) => ({
      Subreddit: item.subreddit,
      Relevance: item.relevance,
      Approach: item.approach,
    })),
  );

  addRows(
    workbook.addWorksheet("Keywords"),
    (brand.keywords || []).map((keyword) => ({
      Type: keyword.toLowerCase().includes(brand.name.toLowerCase()) ? "Branded" : "Tracked",
      Keyword: keyword,
    })),
  );

  addRows(
    workbook.addWorksheet("Action Plan"),
    actionPlan(brand, mentions).map((item) => ({
      Step: item.step,
      Action: item.action,
    })),
  );

  for (const sheet of workbook.worksheets) {
    sheet.name = cleanSheetName(sheet.name);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
