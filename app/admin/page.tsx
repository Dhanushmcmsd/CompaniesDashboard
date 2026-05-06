"use client";

import { useEffect, useMemo, useState } from "react";

type RequestItem = {
  id: string;
  company: string;
  note: string | null;
  status: string;
  requestedAt: string;
  userId: string;
  user: { name: string; email: string; role: string; company: string | null };
};

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/requests");
    const data = await res.json();
    setRequests(data.requests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(requestId: string, action: "approve" | "reject") {
    const role = action === "approve" ? (window.prompt("Role: EMPLOYEE or MANAGEMENT", "EMPLOYEE") ?? "EMPLOYEE") : undefined;
    const company = action === "approve" ? window.prompt("Company", "Supra Pacific") ?? "Supra Pacific" : undefined;

    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action, role, company }),
    });

    await load();
  }

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    return { pending, approved, total: requests.length };
  }, [requests]);

  const pendingRows = requests.filter((r) => r.status === "pending");
  const historyRows = requests.filter((r) => r.status !== "pending");

  return (
    <div className="p-6">
      <header className="bg-[#0f172a] text-white rounded-xl px-5 py-4 mb-4">
        <h1 className="font-bold text-xl">Admin Panel — Access Requests</h1>
        <p className="text-sm text-gray-300 mt-1">{stats.pending} pending · {stats.approved} approved · {stats.total} total</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-auto">
        {loading ? <div className="h-40 animate-pulse bg-gray-100 rounded-xl" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th><th>Email</th><th>Company</th><th>Note</th><th>Requested At</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.user.name}</td>
                  <td>{r.user.email}</td>
                  <td>{r.company}</td>
                  <td>{r.note ?? "-"}</td>
                  <td>{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="space-x-2">
                    <button onClick={() => review(r.id, "approve")} className="px-2 py-1 rounded bg-green-100 text-green-700">Approve</button>
                    <button onClick={() => review(r.id, "reject")} className="px-2 py-1 rounded bg-red-100 text-red-700">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <details className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <summary className="cursor-pointer font-semibold">Approved/Rejected History</summary>
        <div className="mt-3 space-y-2 text-sm">
          {historyRows.map((r) => (
            <div key={r.id} className="border rounded-lg px-3 py-2">
              {r.user.name} ({r.user.email}) · {r.status} · {new Date(r.requestedAt).toLocaleString()}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
