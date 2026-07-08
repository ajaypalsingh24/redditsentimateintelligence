import { redirect } from "next/navigation";
import { login, signup } from "@/app/actions";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; signup?: string; mode?: string }> }) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  const params = (await searchParams) || {};
  const mode = params.mode === "signup" ? "signup" : "signin";

  return (
    <main className="auth-shell min-h-screen px-5 py-8 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_430px]">
        <div className="max-w-xl">
          <div className="reddify-logo" aria-label="reddify.me">
            <span>reddify</span>
            <span className="logo-dot">.</span>
            <span className="logo-me">me</span>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-red-200">Reddify Sentiment Intelligence</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
            Reddit reputation reports for every project, scan, and client-ready export.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-red-50/80">
            Track brand sentiment, separate visibility opportunities from true sentiment, and keep historical scan snapshots in one focused dashboard.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Scan snapshots", "Review each run separately"],
              ["Project dashboards", "No mixed client data"],
              ["PDF exports", "Tab-wise or complete reports"],
            ].map(([title, copy]) => (
              <article key={title} className="rounded-lg border border-white/10 bg-white/8 p-3 backdrop-blur">
                <strong className="block text-xs text-white">{title}</strong>
                <span className="mt-1 block text-xs leading-5 text-red-50/70">{copy}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="auth-card overflow-hidden rounded-xl border border-white/12 bg-white p-2 text-slate-950 shadow-2xl">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
            <a
              href="/login?mode=signin"
              className={`rounded-md px-4 py-3 text-center ${mode === "signin" ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-red-700"}`}
            >
              Sign in
            </a>
            <a
              href="/login?mode=signup"
              className={`rounded-md px-4 py-3 text-center ${mode === "signup" ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-red-700"}`}
            >
              Sign up
            </a>
          </div>

          <div className="grid gap-6 p-5">
            {mode === "signin" ? (
              <section id="signin" className="rounded-lg border border-slate-200 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Welcome back</p>
                <h2 className="mt-2 text-2xl font-bold">Sign in to Reddify</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Use your email and password to open the sentiment dashboard.</p>
                {params.error ? (
                  <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">Incorrect email or password.</p>
                ) : null}
                <form action={login} className="mt-5 grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Email
                    <input name="email" type="email" className="field auth-field" placeholder="Email" autoFocus />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Password
                    <input name="password" type="password" className="field auth-field" placeholder="Password" />
                  </label>
                  <button className="rounded-md bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800">
                    Sign in
                  </button>
                </form>
              </section>
            ) : null}

            {mode === "signup" ? (
              <section id="signup" className="rounded-lg border border-red-100 bg-red-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Create account</p>
                <h2 className="mt-2 text-xl font-bold">Sign up</h2>
                {params.signup === "error" ? (
                  <p className="mt-4 rounded-md bg-white p-3 text-sm font-semibold text-red-700">Passwords do not match or are incorrect.</p>
                ) : null}
                <form action={signup} className="mt-5 grid gap-4">
                  <input name="email" type="email" className="field auth-field" placeholder="Email" autoFocus />
                  <input name="password" type="password" className="field auth-field" placeholder="Password" />
                  <input name="confirmPassword" type="password" className="field auth-field" placeholder="Confirm password" />
                  <button className="rounded-md border border-red-700 px-4 py-3 text-sm font-bold text-red-700 hover:bg-white">
                    Sign up
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
