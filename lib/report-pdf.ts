import PDFDocument from "pdfkit";
import { actionRequired, opportunityInference, overallInsight, sentimentBreakdown, sourceKeyword } from "@/lib/report";
import { BrandRecord, MentionRecord, ScanRunRecord } from "@/lib/store";

type PdfInput = {
  brand: BrandRecord;
  mentions: MentionRecord[];
  scanRun?: ScanRunRecord;
  mode: "tab" | "complete";
};

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function scanLabel(scanRun?: ScanRunRecord) {
  if (!scanRun) {
    return "All saved data";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(scanRun.scannedAt);
}

function text(doc: PDFKit.PDFDocument, value: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(value.replace(/\s+/g, " ").trim(), options);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1.1);
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(title);
  doc.moveDown(0.35);
  doc.strokeColor("#e5e7eb").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.6);
}

function threadBlock(doc: PDFKit.PDFDocument, mention: MentionRecord, brand: BrandRecord, mode: "sentiment" | "opportunity") {
  if (doc.y > 690) {
    doc.addPage();
  }

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(mention.title, { continued: false });
  doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(mention.url, { width: 495 });
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(mode === "sentiment" ? "#b91c1c" : "#0f766e");
  doc.text(mode === "sentiment" ? `Sentiment: ${mention.sentiment}` : "Opportunity only");
  doc.font("Helvetica").fontSize(9).fillColor("#334155");
  text(doc, mode === "sentiment" ? mention.reason || mention.snippet : opportunityInference(brand, mention), { width: 495 });
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(8.5).fillColor("#64748b");
  text(doc, mode === "sentiment" ? `Action: ${actionRequired(mention)}` : `Keyword: ${sourceKeyword(mention)} · ${mention.subreddit || "Reddit"}`, {
    width: 495,
  });
  doc.moveDown(0.7);
}

export async function generateReportPdf({ brand, mentions, scanRun, mode }: PdfInput) {
  const sentimentMentions = mentions.filter((mention) => mention.isBrandMentioned !== false);
  const opportunityMentions = mentions.filter((mention) => mention.isBrandMentioned === false);
  const stats = sentimentBreakdown(sentimentMentions);

  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `${brand.name} Reddit Sentiment Report`,
      Author: "reddify.me",
      Subject: "Reddit sentiment and opportunity report",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, 595, 126).fill("#fff1f2");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(22).text("reddify", 50, 42, { continued: true });
  doc.fillColor("#dc2626").text(".me", { continued: false });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("SENTIMENT INTELLIGENCE", 50, 70, { characterSpacing: 1.3 });
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(`${brand.name} Reddit Sentiment Report`, 300, 38, {
    align: "right",
    width: 245,
  });
  doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(brand.website || "Client report", 300, 82, { align: "right", width: 245 });

  doc.y = 150;
  doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Generated: ${dateLabel(new Date())}`);
  doc.text(`Report snapshot: ${scanLabel(scanRun)}`);
  doc.text(`Export mode: ${mode === "complete" ? "Complete report" : "Current tab report"}`);

  sectionTitle(doc, "Executive Summary");
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  text(doc, overallInsight(brand, sentimentMentions), { width: 495, lineGap: 2 });

  doc.moveDown(1);
  const boxY = doc.y;
  [
    ["Sentiment score", stats.total ? String(stats.sentimentScore) : "NA"],
    ["Positive", `${stats.positivePct}%`],
    ["Neutral", `${stats.neutralPct}%`],
    ["Negative", `${stats.negativePct}%`],
  ].forEach(([label, value], index) => {
    const x = 50 + index * 124;
    doc.roundedRect(x, boxY, 112, 58, 8).fillAndStroke("#f8fafc", "#e2e8f0");
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(value, x + 10, boxY + 12, { width: 92 });
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(label, x + 10, boxY + 36, { width: 92 });
  });
  doc.y = boxY + 78;

  sectionTitle(doc, "Sentiment Threads");
  if (sentimentMentions.length) {
    sentimentMentions.slice(0, 18).forEach((mention) => threadBlock(doc, mention, brand, "sentiment"));
  } else {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No brand-mentioned Reddit sentiment threads are available for this snapshot.");
  }

  if (mode === "complete") {
    doc.addPage();
    sectionTitle(doc, "Opportunity Threads");
    if (opportunityMentions.length) {
      opportunityMentions.slice(0, 18).forEach((mention) => threadBlock(doc, mention, brand, "opportunity"));
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No brand-absent opportunity threads are available for this snapshot.");
    }
  }

  doc.end();
  return done;
}
