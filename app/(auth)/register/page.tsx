"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const COMPANIES = [
  "Supra Pacific",
  "Ideal Supermarket",
  "CFCICI",
  "Central Bazar",
  "Centora",
  "Central Bio Fuel",
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState(COMPANIES[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, confirmPassword, company, note }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      return;
    }

    setSuccess(true);
  }

  return (
    <main className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#0f172a]">Request Access</h1>

        {success ? (
          <div className="mt-6">
            <div className="rounded-lg border border-green-200 bg-green-50 text-green-700 px-4 py-3">
              ✓ Request submitted. Admin will review your access.
            </div>
            <Link href="/login" className="inline-block mt-5 text-sm text-[#0f172a] hover:underline">← Back to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required className="w-full border border-gray-300 rounded-xl px-3 py-2" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required className="w-full border border-gray-300 rounded-xl px-3 py-2" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required className="w-full border border-gray-300 rounded-xl px-3 py-2" />
            <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm Password" required className="w-full border border-gray-300 rounded-xl px-3 py-2" />
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2">
              {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to admin (optional)" className="w-full border border-gray-300 rounded-xl px-3 py-2 min-h-24" />
            <button disabled={loading} className="w-full bg-[#0f172a] text-white rounded-xl py-2.5 hover:bg-[#1e3a5f] disabled:opacity-60">
              {loading ? "Submitting..." : "Submit Request"}
            </button>
            <Link href="/login" className="inline-block text-sm text-[#0f172a] hover:underline">← Back to Sign In</Link>
          </form>
        )}
      </div>
    </main>
  );
}
