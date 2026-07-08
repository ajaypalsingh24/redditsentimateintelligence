import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "reddit_dashboard_session";

function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD || process.env.AUTH_PASSWORD || "admin123";
}

export async function isAuthenticated() {
  const jar = await cookies();
  return jar.get(cookieName)?.value === dashboardPassword();
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function signIn(password: string) {
  if (password !== dashboardPassword()) {
    return false;
  }

  const jar = await cookies();
  jar.set(cookieName, password, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(cookieName);
}
