"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function getHomeByRole(role?: string | null) {
  if (role === "ADMIN") return "/admin";
  if (role === "EMPLOYEE") return "/upload";
  if (role === "MANAGEMENT") return "/dashboard";
  return "/login";
}

function getLoginErrorMessage(error?: string | null) {
  if (!error) return null;
  if (error === "CredentialsSignin") return "Invalid email or password";
  if (error.toLowerCase().includes("pending")) {
    return "Your account is pending admin approval";
  }
  return error;
}

export default function LoginPage() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = params.get("error");
  const pendingMsg = useMemo(() => {
    if (urlError === "pending") return "Your account is pending admin approval";
    return null;
  }, [urlError]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(getLoginErrorMessage(result.error));
      return;
    }

    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();
    const role = session?.user?.role as string | undefined;

    if (role === "PENDING") {
      window.location.href = "/login?error=pending";
      return;
    }

    window.location.href = getHomeByRole(role);
  }

  return (
    <main className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#0f172a]">Companies Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Management Platform</p>

        {(pendingMsg || error) && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {pendingMsg ?? error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Password</label>
            <div className="mt-1 flex border border-gray-300 rounded-xl overflow-hidden">
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required className="flex-1 px-3 py-2" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-3 text-sm text-gray-600">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-[#0f172a] text-white rounded-xl py-2.5 hover:bg-[#1e3a5f] disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <Link href="/register" className="inline-block mt-5 text-sm text-[#0f172a] hover:underline">
          Request Access →
        </Link>

        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-gray-400 leading-relaxed">
            Local dev accounts (run <code className="text-gray-500">npm run db:seed</code> if login fails):
            <br />
            Employee — <span className="text-gray-500">emp@dashboard.com</span> / <span className="text-gray-500">emp123</span>
            <br />
            Management — <span className="text-gray-500">management@dashboard.com</span> / <span className="text-gray-500">mgmt123</span>
          </p>
        )}
      </div>
    </main>
  );
}
