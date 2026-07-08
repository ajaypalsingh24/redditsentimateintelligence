"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { emailConfigured, sendReportEmail } from "@/lib/report-email";
import { generateReportPdf } from "@/lib/report-pdf";
import { scanBrands } from "@/lib/scanner";
import {
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  getBrandsWithMentions,
  updateBrand as updateBrandRecord,
} from "@/lib/store";

function parseKeywords(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[\n,]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export async function login(formData: FormData) {
  const ok = await signIn(String(formData.get("password") || ""));
  if (!ok) {
    redirect("/login?error=1");
  }
  redirect("/");
}

export async function signup(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || password !== confirmPassword) {
    redirect("/login?signup=error");
  }

  const ok = await signIn(password);
  if (!ok) {
    redirect("/login?signup=error");
  }

  redirect("/");
}

export async function logout() {
  await signOut();
  redirect("/login");
}

export async function createBrand(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return;
  }

  let createdBrand: { id: string } | null = null;

  try {
    createdBrand = await createBrandRecord({
      name,
      clientEmail: String(formData.get("clientEmail") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      businessSummary: String(formData.get("businessSummary") || "").trim(),
      targetAudience: String(formData.get("targetAudience") || "").trim(),
      targetMarkets: parseKeywords(formData.get("targetMarkets")),
      services: parseKeywords(formData.get("services")),
      competitors: parseKeywords(formData.get("competitors")),
      seedSubreddits: parseKeywords(formData.get("seedSubreddits")),
      knownThreads: parseKeywords(formData.get("knownThreads")),
      keywords: parseKeywords(formData.get("keywords")),
      brandAccounts: parseKeywords(formData.get("brandAccounts")),
      isActive: formData.get("isActive") === "on",
    });

    revalidatePath("/");
  } catch (error) {
    console.error("createBrand failed:", error instanceof Error ? error.message : error);
    redirect("/?storage=error");
  }

  redirect(createdBrand ? `/?project=${createdBrand.id}&tab=overview&created=1` : "/");
}

export async function updateBrand(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) {
    return;
  }

  try {
    await updateBrandRecord(id, {
      name,
      clientEmail: String(formData.get("clientEmail") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      businessSummary: String(formData.get("businessSummary") || "").trim(),
      targetAudience: String(formData.get("targetAudience") || "").trim(),
      targetMarkets: parseKeywords(formData.get("targetMarkets")),
      services: parseKeywords(formData.get("services")),
      competitors: parseKeywords(formData.get("competitors")),
      seedSubreddits: parseKeywords(formData.get("seedSubreddits")),
      knownThreads: parseKeywords(formData.get("knownThreads")),
      keywords: parseKeywords(formData.get("keywords")),
      brandAccounts: parseKeywords(formData.get("brandAccounts")),
      isActive: formData.get("isActive") === "on",
    });

    revalidatePath("/");
  } catch (error) {
    console.error("updateBrand failed:", error instanceof Error ? error.message : error);
    redirect("/?storage=error");
  }
}

export async function deleteBrand(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) {
    return;
  }

  try {
    await deleteBrandRecord(id);
    revalidatePath("/");
  } catch (error) {
    console.error("deleteBrand failed:", error instanceof Error ? error.message : error);
    redirect("/?storage=error");
  }

  redirect("/");
}

export async function runManualScan(formData: FormData) {
  const brandId = String(formData.get("brandId") || "");
  let summary: Awaited<ReturnType<typeof scanBrands>> | null = null;
  try {
    summary = await scanBrands(brandId || undefined);
    revalidatePath("/");
  } catch (error) {
    console.error("runManualScan failed:", error instanceof Error ? error.message : error);
    redirect("/?storage=error");
  }

  const scanStatus = summary?.errors.length ? "scan=error" : "scan=done";
  redirect(brandId ? `/?project=${brandId}&${scanStatus}` : `/?${scanStatus}`);
}

export async function emailReportPdf(formData: FormData) {
  const brandId = String(formData.get("brandId") || "");
  const scanId = String(formData.get("scanId") || "");
  const mode = String(formData.get("mode") || "complete") === "tab" ? "tab" : "complete";
  const recipientOverride = String(formData.get("recipient") || "").trim();
  const theme = String(formData.get("theme") || "red");
  const tab = String(formData.get("tab") || "overview");

  const brands = await getBrandsWithMentions();
  const brand = brands.find((item) => item.id === brandId);
  if (!brand) {
    redirect(`/?email=missing-project&theme=${theme}`);
  }

  const scanRun = brand.scanRuns?.find((item) => item.id === scanId);
  const mentions = scanRun
    ? (brand.mentions || []).filter((mention) => new Set(scanRun.mentionIds).has(mention.id))
    : brand.mentions || [];
  const to = recipientOverride || brand.clientEmail;

  if (!to) {
    redirect(`/?project=${brand.id}&tab=${tab}&theme=${theme}&email=missing-recipient`);
  }

  if (!emailConfigured()) {
    redirect(`/?project=${brand.id}&tab=${tab}&theme=${theme}&email=missing-config`);
  }

  try {
    const pdf = await generateReportPdf({ brand, mentions, scanRun, mode });
    const safeBrandName = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
    await sendReportEmail({
      to,
      subject: `${brand.name} Reddit Sentiment Report`,
      filename: `${safeBrandName}-reddit-sentiment-report.pdf`,
      pdf,
      html: `
        <p>Hi,</p>
        <p>Please find attached the Reddit sentiment report for <strong>${brand.name}</strong>.</p>
        <p>This report separates true brand sentiment from Reddit visibility opportunities.</p>
        <p>Regards,<br/>Reddify Reports</p>
      `,
    });
  } catch (error) {
    console.error("emailReportPdf failed:", error instanceof Error ? error.message : error);
    redirect(`/?project=${brand.id}&tab=${tab}&theme=${theme}&email=error`);
  }

  revalidatePath("/");
  redirect(`/?project=${brand.id}&tab=${tab}&theme=${theme}&email=sent`);
}
