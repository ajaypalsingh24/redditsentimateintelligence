import { createBrand, deleteBrand, emailReportPdf, logout, runManualScan, updateBrand } from "@/app/actions";
import { ExportMenu } from "@/app/components/ExportPdfButton";
import { RedditScraperPanel } from "@/app/components/RedditScraperPanel";
import { requireAuth } from "@/lib/auth";
import { getRedditAccountReference } from "@/lib/reddit";
import {
  actionPlan,
  actionRequired,
  joinList,
  opportunityInference,
  overallInsight,
  sentimentBreakdown,
  sourceKeyword,
  strategicActionOverview,
  subredditTargets,
  threadPriority,
  topThemes,
  visibilityGapSummary,
} from "@/lib/report";
import { BrandRecord, MentionRecord, ScanRunRecord, getBrandsWithMentions } from "@/lib/store";

export const dynamic = "force-dynamic";

type TabKey = "overview" | "sentiment" | "opportunities" | "threads" | "scraper" | "account" | "settings";

const tabs: Array<{ key: TabKey; label: string; helper: string }> = [
  { key: "overview", label: "Overview", helper: "Summary, trends, and score" },
  { key: "sentiment", label: "Sentiment", helper: "Brand-mentioned threads only" },
  { key: "opportunities", label: "Opportunities", helper: "Brand-absent visibility gaps" },
  { key: "threads", label: "Threads", helper: "URLs, summaries, and actions" },
  { key: "scraper", label: "Apify Scraper", helper: "Manual Reddit URL scrape" },
  { key: "account", label: "Brand Account", helper: "Reddit profile reference" },
  { key: "settings", label: "Projects", helper: "Setup and saved projects" },
];

function badgeClass(sentiment: string) {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (sentiment === "negative") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (sentiment === "not-applicable") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function scoreLabel(score: number, total: number) {
  if (!total) return "No sentiment baseline";
  if (score >= 70) return "Mostly positive";
  if (score >= 45) return "Mixed / neutral";
  return "Needs attention";
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function scanLabel(scanRun?: ScanRunRecord) {
  if (!scanRun) return "All saved data";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(scanRun.scannedAt);
}

function scanMentions(mentions: MentionRecord[], scanRun?: ScanRunRecord) {
  if (!scanRun) return mentions;
  const ids = new Set(scanRun.mentionIds);
  return mentions.filter((mention) => ids.has(mention.id));
}

function themeClass(theme?: string) {
  if (theme === "dark") return "theme-dark";
  if (theme === "blue") return "theme-blue";
  return "theme-red";
}

function metric(label: string, value: string | number, helper: string) {
  return (
    <article className="metric-card rounded-lg bg-white p-4">
      <strong className="block text-3xl text-slate-950">{value}</strong>
      <p className="mt-2 text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </article>
  );
}

function sentimentCards(stats: ReturnType<typeof sentimentBreakdown>) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {[
        ["Positive", stats.positive, stats.positivePct, "bg-emerald-500"],
        ["Neutral", stats.neutral, stats.neutralPct, "bg-slate-500"],
        ["Negative", stats.negative, stats.negativePct, "bg-rose-500"],
      ].map(([label, count, pct, color]) => (
        <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-end justify-between">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <strong className="text-3xl">{pct}%</strong>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, Number(pct)))}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {count} thread{count === 1 ? "" : "s"}
          </p>
        </article>
      ))}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  await requireAuth();

  const params = (await searchParams) || {};
  const brands = await getBrandsWithMentions();
  const activeTab = (tabs.some((item) => item.key === params.tab) ? params.tab : "overview") as TabKey;
  const brand = brands.find((item) => item.id === params.project) || brands[0];
  const theme = params.theme || "red";
  const scanRuns = brand?.scanRuns ?? [];
  const selectedScanRun = scanRuns.find((scanRun) => scanRun.id === params.scan);
  const previousScanRun = selectedScanRun ? scanRuns.find((scanRun) => scanRun.scannedAt < selectedScanRun.scannedAt) : scanRuns[1];

  const allMentions = brand?.mentions ?? [];
  const selectedMentions = scanMentions(allMentions, selectedScanRun);
  const currentMentions = selectedMentions;
  const pastMentions = previousScanRun ? scanMentions(allMentions, previousScanRun) : [];
  const sentimentMentions = selectedMentions.filter((mention) => mention.isBrandMentioned !== false);
  const opportunityOnlyMentions = selectedMentions.filter((mention) => mention.isBrandMentioned === false);
  const currentStats = sentimentBreakdown(currentMentions);
  const pastStats = sentimentBreakdown(pastMentions);
  const stats = sentimentBreakdown(sentimentMentions);
  const themes = topThemes(sentimentMentions);
  const subreddits = brand ? subredditTargets(brand, selectedMentions).slice(0, 8) : [];
  const strategy = brand ? strategicActionOverview(brand, sentimentMentions) : null;
  const plan = brand ? actionPlan(brand, selectedMentions).slice(0, 5) : [];
  const accounts = brand ? (brand.brandAccounts || []).map((account) => getRedditAccountReference(account)) : [];
  const opportunityThreads = selectedMentions
    .filter(
      (mention) =>
        mention.isBrandMentioned === false || mention.sentiment === "neutral" || mention.opportunityType === "answer-opportunity",
    )
    .slice(0, 20);
  const themeQuery = `theme=${theme}`;
  const scanQuery = selectedScanRun ? `&scan=${selectedScanRun.id}` : "";
  const queryBase = `project=${brand?.id || ""}${scanQuery}&${themeQuery}`;
  const themeBase = `project=${brand?.id || ""}${scanQuery}&tab=${activeTab}`;
  const excelHref = `/api/export/excel?project=${brand?.id || ""}${selectedScanRun ? `&scan=${selectedScanRun.id}` : ""}`;
  return (
    <main className={`min-h-screen app-shell ${themeClass(theme)} text-slate-950`}>
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="no-print sidebar p-5 text-white">
          <a href={`/?${themeQuery}`} className="sidebar-brand inline-flex items-center gap-3 rounded-lg">
            <span className="sidebar-logo" aria-label="reddify.me">
              <span>reddify</span>
              <span className="logo-dot">.</span>
              <span className="logo-me">me</span>
            </span>
            <span className="sidebar-tool-name">sentiment intelligence</span>
          </a>

          <div className="mt-8">
            <p className="text-xs font-bold uppercase text-white/60">Active project</p>
            <h1 className="mt-3 text-2xl font-bold">{brand?.name || "No project"}</h1>
            <p className="mt-2 text-sm text-white/70">{brand ? `${brand.website || "No website"} - ${joinList(brand.targetMarkets, "No market")}` : "Add a project"}</p>
            <div className="mt-5 flex gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Ready</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{brands.length} project{brands.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-2 text-xs font-bold uppercase text-white/60">Projects</p>
            <div className="grid gap-2">
              {brands.map((project) => (
                <a
                  key={project.id}
                  href={`/?project=${project.id}&tab=overview&${themeQuery}`}
                  className={`project-link rounded-lg px-4 py-3 text-sm ${project.id === brand?.id ? "project-link-active" : ""}`}
                >
                  <strong className="block">{project.name}</strong>
                  <span className="mt-1 block text-xs">
                    {(project.scanRuns || []).length} scan snapshot{(project.scanRuns || []).length === 1 ? "" : "s"}
                  </span>
                </a>
              ))}
              <a href={`/?project=${brand?.id || ""}&tab=settings&${themeQuery}`} className="sidebar-outline rounded-lg px-4 py-3 text-sm font-bold">
                + Add or edit project
              </a>
            </div>
          </div>

          <nav className="mt-8 grid gap-2">
            <p className="mb-2 text-xs font-bold uppercase text-white/60">Report tabs</p>
            {tabs.map((tab) => (
              <a
                key={tab.key}
                href={`/?${queryBase}&tab=${tab.key}`}
                className={`nav-link rounded-lg px-4 py-3 ${activeTab === tab.key ? "nav-link-active" : ""}`}
              >
                <strong className="block">{tab.label}</strong>
                <span className="mt-1 block text-xs">{tab.helper}</span>
              </a>
            ))}
          </nav>

          <div className="mt-8">
            <p className="mb-2 text-xs font-bold uppercase text-white/60">Theme</p>
            <div className="theme-switcher grid grid-cols-3 gap-2">
              {[
                ["red", "Red"],
                ["blue", "Blue"],
                ["dark", "Dark"],
              ].map(([value, label]) => (
                <a
                  key={value}
                  href={`/?${themeBase}&theme=${value}`}
                  className={`theme-option rounded-md px-3 py-2 text-center text-xs font-bold ${theme === value ? "theme-option-active" : ""}`}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-5 lg:p-6">
          {params.created ? (
            <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="text-sm font-bold">Project added successfully.</p>
              <p className="mt-1 text-sm leading-6">
                This dashboard is empty until you run the first Reddit scan. Click <strong>Scan Reddit</strong> to collect sentiment and opportunity data for this project.
              </p>
            </section>
          ) : null}

          {params.scan === "done" ? (
            <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="text-sm font-bold">Scan completed.</p>
              <p className="mt-1 text-sm leading-6">If no data appears, the scan did not find relevant Reddit results for the current keywords.</p>
            </section>
          ) : null}

          {params.scan === "error" ? (
            <section className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p className="text-sm font-bold">Scan finished with errors.</p>
              <p className="mt-1 text-sm leading-6">Check that the project has keywords and that the SerpApi key is configured correctly.</p>
            </section>
          ) : null}

          {params.email === "sent" ? (
            <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="text-sm font-bold">PDF report emailed successfully.</p>
              <p className="mt-1 text-sm leading-6">The client received the generated Reddit sentiment PDF as an attachment.</p>
            </section>
          ) : null}

          {params.email === "missing-config" ? (
            <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-sm font-bold">Email provider not configured.</p>
              <p className="mt-1 text-sm leading-6">Add `RESEND_API_KEY` and `EMAIL_FROM`, or SMTP settings, to send PDF reports directly.</p>
            </section>
          ) : null}

          {params.email === "missing-recipient" || params.email === "error" ? (
            <section className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p className="text-sm font-bold">{params.email === "missing-recipient" ? "Client email missing." : "Email failed."}</p>
              <p className="mt-1 text-sm leading-6">
                {params.email === "missing-recipient"
                  ? "Add a client email in the project settings or enter one before sending."
                  : "Check the email provider credentials and try again."}
              </p>
            </section>
          ) : null}

          <header className="dashboard-hero rounded-xl bg-white p-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_620px] xl:items-start">
              <div>
                <p className="text-sm font-bold uppercase text-red-700">Reddify sentiment dashboard</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">{brand?.name || "Create a project"}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Report snapshot: {scanLabel(selectedScanRun)}. Previous scans stay available as historical sentiment records.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-chip rounded-full px-3 py-2 text-xs font-bold">
                    {stats.total} sentiment thread{stats.total === 1 ? "" : "s"}
                  </span>
                  <span className="status-chip rounded-full px-3 py-2 text-xs font-bold">
                    {opportunityOnlyMentions.length} opportunity thread{opportunityOnlyMentions.length === 1 ? "" : "s"}
                  </span>
                  <span className="status-chip rounded-full px-3 py-2 text-xs font-bold">{scoreLabel(stats.sentimentScore, stats.total)}</span>
                </div>
              </div>

              <div className="no-print">
                <form className="grid gap-3 sm:grid-cols-[minmax(250px,1fr)_max-content] sm:items-end" action="/">
                  {brand ? <input type="hidden" name="project" value={brand.id} /> : null}
                  <input type="hidden" name="tab" value={activeTab} />
                  <input type="hidden" name="theme" value={theme} />
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Scan snapshot
                    <select name="scan" defaultValue={selectedScanRun?.id || ""} className="field dashboard-field">
                      <option value="">All saved data</option>
                      {scanRuns.map((scanRun) => (
                        <option key={scanRun.id} value={scanRun.id}>
                          {scanLabel(scanRun)} - {scanRun.sentimentMentions} sentiment, {scanRun.opportunityMentions} opportunities
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="quiet-button justify-self-start self-end rounded-md px-2.5 py-1.5 text-xs font-bold leading-5">Apply view</button>
                </form>
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <ExportMenu excelHref={excelHref} />
                  <form action={emailReportPdf} className="flex items-start gap-2">
                    {brand ? <input type="hidden" name="brandId" value={brand.id} /> : null}
                    {selectedScanRun ? <input type="hidden" name="scanId" value={selectedScanRun.id} /> : null}
                    <input type="hidden" name="mode" value="complete" />
                    <input type="hidden" name="theme" value={theme} />
                    <input type="hidden" name="tab" value={activeTab} />
                    <input
                      name="recipient"
                      type="email"
                      defaultValue={brand?.clientEmail || ""}
                      placeholder="client@email.com"
                      className="field h-9 w-44 px-3 py-0 text-xs"
                    />
                    <button className="secondary-button h-9 rounded-md px-3 py-0 text-xs font-bold leading-5">Email PDF</button>
                  </form>
                  <form action={runManualScan}>
                    {brand ? <input type="hidden" name="brandId" value={brand.id} /> : null}
                    <button className="rounded-md primary-button px-3 py-1.5 text-xs font-bold leading-5 text-white">Scan Reddit</button>
                  </form>
                  <form action={logout}>
                    <button className="danger-button rounded-md px-2.5 py-1.5 text-xs font-bold leading-5">Logout</button>
                  </form>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-5 grid gap-4 md:grid-cols-4">
            {metric("Sentiment score", stats.total ? stats.sentimentScore : "NA", "Brand-mentioned Reddit only")}
            {metric("Selected scan score", currentStats.total ? currentStats.sentimentScore : "NA", `${currentStats.total} selected sentiment threads`)}
            {metric("Previous scan score", pastStats.total ? pastStats.sentimentScore : "NA", `${pastStats.total} previous sentiment threads`)}
            {metric("Opportunity threads", opportunityOnlyMentions.length, "Brand absent, topic relevant")}
          </section>

          {!selectedMentions.length ? (
            <section className="empty-state mt-5 rounded-xl bg-white p-5">
              <div>
                <p className="text-sm font-bold uppercase text-red-700">Project saved, scan pending</p>
                <h3 className="mt-2 text-xl font-bold">No Reddit data has been collected for {brand?.name || "this project"} yet</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Adding a project only saves the brand, website, keywords, and settings. Run a scan to fetch Reddit threads, create the first scan snapshot, and show sentiment data here.
                </p>
              </div>
              <form action={runManualScan} className="mt-4">
                {brand ? <input type="hidden" name="brandId" value={brand.id} /> : null}
                <button className="rounded-md primary-button px-3 py-1.5 text-xs font-bold leading-5 text-white">Scan Reddit</button>
              </form>
            </section>
          ) : null}

          <div className="print-report mt-5">
            <section className="print-cover hidden rounded-xl bg-white p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="print-logo" aria-label="reddify.me">
                    <span>reddify</span>
                    <span className="logo-dot">.</span>
                    <span className="logo-me">me</span>
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">sentiment intelligence</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Client Report</p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-950">{brand?.name || "Reddit Sentiment Report"}</h1>
                  <p className="mt-1 text-sm text-slate-500">{brand?.website || "Reddit visibility and sentiment analysis"}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Report snapshot</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{scanLabel(selectedScanRun)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Sentiment score</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{stats.total ? stats.sentimentScore : "NA"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Generated</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{dateLabel(new Date())}</p>
                </div>
              </div>
            </section>

            {activeTab === "overview" ? (
              <OverviewTab
                brand={brand}
                selectedMentions={selectedMentions}
                sentimentMentions={sentimentMentions}
                opportunityOnlyMentions={opportunityOnlyMentions}
                stats={stats}
                currentStats={currentStats}
                pastStats={pastStats}
                strategy={strategy}
              />
            ) : null}

            {activeTab === "sentiment" ? <SentimentTab mentions={sentimentMentions} stats={stats} themes={themes} brand={brand} /> : null}
            {activeTab === "opportunities" ? <OpportunitiesTab brand={brand} mentions={opportunityThreads} subreddits={subreddits} /> : null}
            {activeTab === "threads" ? <ThreadsTab sentimentMentions={sentimentMentions} opportunityMentions={opportunityThreads} brand={brand} /> : null}
            {activeTab === "scraper" ? <RedditScraperPanel /> : null}
            {activeTab === "account" ? <AccountTab accounts={accounts} /> : null}
            {activeTab === "settings" ? <SettingsTab brands={brands} brand={brand} /> : null}

            <div className="complete-report grid gap-5">
              <OverviewTab
                brand={brand}
                selectedMentions={selectedMentions}
                sentimentMentions={sentimentMentions}
                opportunityOnlyMentions={opportunityOnlyMentions}
                stats={stats}
                currentStats={currentStats}
                pastStats={pastStats}
                strategy={strategy}
              />
              <SentimentTab mentions={sentimentMentions} stats={stats} themes={themes} brand={brand} />
              <OpportunitiesTab brand={brand} mentions={opportunityThreads} subreddits={subreddits} />
              <ThreadsTab sentimentMentions={sentimentMentions} opportunityMentions={opportunityThreads} brand={brand} />
              <AccountTab accounts={accounts} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function OverviewTab({
  brand,
  selectedMentions,
  sentimentMentions,
  opportunityOnlyMentions,
  stats,
  currentStats,
  pastStats,
  strategy,
}: {
  brand?: BrandRecord;
  selectedMentions: MentionRecord[];
  sentimentMentions: MentionRecord[];
  opportunityOnlyMentions: MentionRecord[];
  stats: ReturnType<typeof sentimentBreakdown>;
  currentStats: ReturnType<typeof sentimentBreakdown>;
  pastStats: ReturnType<typeof sentimentBreakdown>;
  strategy: ReturnType<typeof strategicActionOverview> | null;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
          <div>
            <p className="text-sm font-bold uppercase text-slate-500">Overall Insight</p>
            <h2 className="mt-2 text-2xl font-bold">{scoreLabel(stats.sentimentScore, stats.total)}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{brand ? overallInsight(brand, sentimentMentions) : "Add a project to generate insight."}</p>
          </div>
          <div className="rounded-lg bg-slate-950 p-5 text-center text-white">
            <p className="text-sm font-bold">Sentiment Score</p>
            <strong className="mt-2 block text-5xl">{stats.total ? stats.sentimentScore : "NA"}</strong>
            <span className="mt-1 block text-xs text-slate-300">{stats.total} sentiment thread{stats.total === 1 ? "" : "s"}</span>
          </div>
        </div>
      </section>

      {sentimentCards(stats)}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold">Selected vs Previous Scan</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Selected scan</p>
              <p className="mt-1 text-2xl font-bold">{currentStats.total ? currentStats.sentimentScore : "NA"}</p>
              <p className="text-sm text-slate-600">{currentStats.positivePct}% positive · {currentStats.neutralPct}% neutral · {currentStats.negativePct}% negative</p>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Previous scan</p>
              <p className="mt-1 text-2xl font-bold">{pastStats.total ? pastStats.sentimentScore : "NA"}</p>
              <p className="text-sm text-slate-600">{pastStats.positivePct}% positive · {pastStats.neutralPct}% neutral · {pastStats.negativePct}% negative</p>
            </div>
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold">Visibility Split</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {sentimentMentions.length} brand-mentioned Reddit thread{sentimentMentions.length === 1 ? "" : "s"} are counted in sentiment. {opportunityOnlyMentions.length} relevant brand-absent thread{opportunityOnlyMentions.length === 1 ? "" : "s"} are tracked only as opportunities.
          </p>
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            Neutral sentiment means the brand is mentioned but discussion is neutral. Brand-absent threads are not counted as neutral.
          </p>
        </article>
      </section>

      {strategy ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-bold uppercase text-slate-500">Action Plan Overview</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ["Overview", strategy.overview],
              ["Current Position", strategy.currentPosition],
              ["Sentiment Summary", strategy.sentimentSummary],
              ["Path Forward", strategy.pathForward],
            ].map(([title, copy]) => (
              <article key={title} className="rounded-md bg-slate-50 p-4">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SentimentTab({ mentions, stats, themes, brand }: { mentions: MentionRecord[]; stats: ReturnType<typeof sentimentBreakdown>; themes: [string, number][]; brand?: BrandRecord }) {
  return (
    <div className="grid gap-5">
      {sentimentCards(stats)}
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold">Sentiment Analysis</h2>
            <p className="mt-1 text-sm text-slate-500">Only brand-mentioned Reddit threads are scored.</p>
          </div>
          <ThreadList mentions={mentions} brand={brand} mode="sentiment" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Themes</h2>
          <div className="mt-4 grid gap-2">
            {themes.length ? themes.map(([theme, count]) => (
              <div key={theme} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold capitalize">{theme}</span>
                <span className="text-slate-500">{count}</span>
              </div>
            )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No themes yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function OpportunitiesTab({ brand, mentions, subreddits }: { brand?: BrandRecord; mentions: MentionRecord[]; subreddits: ReturnType<typeof subredditTargets> }) {
  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-bold uppercase text-slate-500">Opportunity Inference</p>
        <h2 className="mt-2 text-xl font-bold">Reddit visibility gap</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{brand ? visibilityGapSummary(brand, mentions) : "Add a project to find opportunities."}</p>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold">Initial Reddit Threads to Target</h2>
            <p className="mt-1 text-sm text-slate-500">Brand-absent and recommendation-led threads belong here, not in sentiment.</p>
          </div>
          <ThreadList mentions={mentions} brand={brand} mode="opportunity" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Best Subreddits</h2>
          <div className="mt-4 grid gap-3">
            {subreddits.map((item) => (
              <div key={item.subreddit} className="rounded-md bg-slate-50 p-3 text-sm leading-6">
                <strong>{item.subreddit}</strong>
                <p className="text-slate-600">{item.relevance}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ThreadsTab({ sentimentMentions, opportunityMentions, brand }: { sentimentMentions: MentionRecord[]; opportunityMentions: MentionRecord[]; brand?: BrandRecord }) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold">Sentiment Threads</h2>
        </div>
        <ThreadList mentions={sentimentMentions} brand={brand} mode="sentiment" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold">Opportunity Threads</h2>
        </div>
        <ThreadList mentions={opportunityMentions} brand={brand} mode="opportunity" />
      </div>
    </section>
  );
}

function AccountTab({ accounts }: { accounts: ReturnType<typeof getRedditAccountReference>[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Brand Account Sentiment</h2>
      <div className="mt-4 grid gap-3">
        {accounts.length ? accounts.map((account) => (
          <article key={account.input} className="rounded-md border border-slate-200 p-4">
            <a href={account.accountUrl} target="_blank" rel="noreferrer" className="font-bold text-teal-700">u/{account.username}</a>
            <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{account.note}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{account.actionRequired}</p>
          </article>
        )) : <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">Add a Reddit account URL in project settings.</p>}
      </div>
    </section>
  );
}

function SettingsTab({ brands, brand }: { brands: BrandRecord[]; brand?: BrandRecord }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Saved Projects</h2>
        <div className="mt-4 grid gap-2">
          {brands.map((project) => (
            <a key={project.id} href={`/?project=${project.id}&tab=settings`} className={`rounded-md border px-3 py-3 text-sm ${project.id === brand?.id ? "border-teal-200 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <strong className="block">{project.name}</strong>
              <span className="text-xs text-slate-500">{(project.scanRuns || []).length} saved scan snapshot{(project.scanRuns || []).length === 1 ? "" : "s"}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        <ProjectForm mode="create" />
        {brand ? <ProjectForm mode="edit" brand={brand} /> : null}
      </div>
    </section>
  );
}

function ProjectForm({ mode, brand }: { mode: "create" | "edit"; brand?: BrandRecord }) {
  const action = mode === "create" ? createBrand : updateBrand;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" data-testid={`${mode}-project-section`}>
      <h2 className="text-lg font-bold">{mode === "create" ? "New Project" : "Project Settings"}</h2>
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2" data-testid={`${mode}-project-form`}>
        {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
        <input name="name" required defaultValue={brand?.name} placeholder="Project / brand name" className="field" />
        <input name="clientEmail" type="email" defaultValue={brand?.clientEmail} placeholder="Client email for PDF reports" className="field" />
        <input name="website" defaultValue={brand?.website} placeholder="Website" className="field" />
        <input name="targetMarkets" defaultValue={brand ? joinList(brand.targetMarkets, "") : ""} placeholder="Target location" className="field" />
        <input name="services" defaultValue={brand ? joinList(brand.services, "") : ""} placeholder="Services / category" className="field" />
        <input name="competitors" defaultValue={brand ? joinList(brand.competitors, "") : ""} placeholder="Competitors" className="field" />
        <textarea name="businessSummary" defaultValue={brand?.businessSummary} rows={3} placeholder="Brand overview" className="field resize-none md:col-span-2" />
        <textarea name="keywords" defaultValue={brand ? joinList(brand.keywords, "\n") : ""} rows={4} placeholder="Keywords / aliases" className="field resize-none" />
        <textarea name="knownThreads" defaultValue={brand ? joinList(brand.knownThreads, "\n") : ""} rows={4} placeholder="Known Reddit URLs" className="field resize-none" />
        <input name="brandAccounts" defaultValue={brand ? joinList(brand.brandAccounts, "") : ""} placeholder="Reddit account" className="field" />
        <input name="seedSubreddits" defaultValue={brand ? joinList(brand.seedSubreddits, "") : ""} placeholder="Target subreddits" className="field" />
        <input name="isActive" type="hidden" value="on" />
        <div className="flex gap-3 md:col-span-2">
          <button className="rounded-md bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800">{mode === "create" ? "Create Project" : "Save Project"}</button>
        </div>
      </form>
      {mode === "edit" && brand ? (
        <form action={deleteBrand} className="mt-3">
          <input type="hidden" name="id" value={brand.id} />
          <button className="text-sm font-bold text-rose-700 hover:text-rose-900">Delete project</button>
        </form>
      ) : null}
    </section>
  );
}

function ThreadList({ mentions, brand, mode }: { mentions: MentionRecord[]; brand?: BrandRecord; mode: "sentiment" | "opportunity" }) {
  if (!mentions.length) {
    return <p className="p-8 text-center text-sm leading-6 text-slate-500">No threads in this view yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {mentions.map((mention) => (
        <article key={mention.id} className="grid gap-3 p-5">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1 capitalize ring-1 ${badgeClass(mention.sentiment)}`}>
              {mention.isBrandMentioned === false ? "Opportunity only" : mention.sentiment}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">{mention.subreddit || "Reddit"}</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-700 ring-1 ring-teal-200">Keyword: {sourceKeyword(mention)}</span>
          </div>
          <a href={mention.url} target="_blank" rel="noreferrer" className="font-bold text-slate-950 hover:text-teal-700">{mention.title}</a>
          <p className="text-sm leading-6 text-slate-600">
            <strong className="text-slate-950">{mode === "opportunity" ? "Opportunity summary: " : "Sentiment summary: "}</strong>
            {mention.reason || mention.snippet}
          </p>
          {mode === "opportunity" && brand ? (
            <p className="rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-950">
              <strong>Opportunity: </strong>
              {opportunityInference(brand, mention)}
            </p>
          ) : (
            <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <strong>Action: </strong>
              {actionRequired(mention)} · {threadPriority(mention)} priority · {mention.confidence}% confidence · {dateLabel(mention.detectedAt)}
            </p>
          )}
          <p className="break-all text-xs text-slate-500">{mention.url}</p>
        </article>
      ))}
    </div>
  );
}
