"use client";

import { useEffect, useMemo, useState } from "react";

type RequestItem = {
  id: string;
  company: string;
  note: string | null;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  userId: string;
  user: { name: string; email: string; role: string; company: string | null };
};

const COMPANY_OPTIONS = ["supra", "ideal", "cfcici", "centralbazar", "centora", "centralbiofuel"] as const;
const ROLE_OPTIONS = ["EMPLOYEE", "MANAGEMENT"] as const;

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, { role: "EMPLOYEE" | "MANAGEMENT"; company: string }>>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/requests", { cache: "no-store" });
    const data = await res.json();
    const rows = (data.requests ?? []) as RequestItem[];
    setRequests(rows);
    setAssignments((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!next[r.id]) {
          next[r.id] = {
            role: "EMPLOYEE",
            company: COMPANY_OPTIONS.includes(r.company as (typeof COMPANY_OPTIONS)[number]) ? r.company : "supra",
          };
        }
      }
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(requestId: string, action: "approve" | "reject") {
    const body =
      action === "approve"
        ? { requestId, action, role: assignments[requestId]?.role ?? "EMPLOYEE", company: assignments[requestId]?.company ?? "supra" }
        : { requestId, action };

    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await load();
  }

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  const pendingRows = requests.filter((r) => r.status === "pending");
  const approvedRows = requests.filter((r) => r.status === "approved");
  const rejectedRows = requests.filter((r) => r.status === "rejected");

  return (
    <div className="p-6 space-y-4">
      <header className="bg-[#0f172a] text-white rounded-xl px-5 py-4">
        <h1 className="font-bold text-xl">Admin Panel — Access Requests & Logs</h1>
        <p className="text-sm text-gray-300 mt-1">
          {stats.pending} pending · {stats.approved} approved · {stats.rejected} rejected · {stats.total} total
        </p>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-auto">
        {loading ? (
          <div className="h-40 animate-pulse bg-gray-100 rounded-xl" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Requested Company</th>
                <th>Note</th>
                <th>Requested At</th>
                <th>Assign Role</th>
                <th>Assign Company</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2">{r.user.name}</td>
                  <td>{r.user.email}</td>
                  <td>{r.company}</td>
                  <td>{r.note ?? "-"}</td>
                  <td>{new Date(r.requestedAt).toLocaleString()}</td>
                  <td>
                    <select
                      value={assignments[r.id]?.role ?? "EMPLOYEE"}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [r.id]: { ...(prev[r.id] ?? { company: "supra", role: "EMPLOYEE" }), role: e.target.value as "EMPLOYEE" | "MANAGEMENT" },
                        }))
                      }
                      className="border border-gray-300 rounded px-2 py-1"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={assignments[r.id]?.company ?? "supra"}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [r.id]: { ...(prev[r.id] ?? { company: "supra", role: "EMPLOYEE" }), company: e.target.value },
                        }))
                      }
                      className="border border-gray-300 rounded px-2 py-1"
                    >
                      {COMPANY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="space-x-2">
                    <button onClick={() => review(r.id, "approve")} className="px-2 py-1 rounded bg-green-100 text-green-700">Approve</button>
                    <button onClick={() => review(r.id, "reject")} className="px-2 py-1 rounded bg-red-100 text-red-700">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h2 className="font-semibold text-[#0f172a] mb-2">Audit History</h2>
        <div className="space-y-2 text-sm">
          {approvedRows.map((r) => (
            <div key={r.id} className="border rounded-lg px-3 py-2 bg-green-50 border-green-200">
              Approved · {r.user.name} ({r.user.email}) · {r.company} · Reviewed {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "-"} by {r.reviewedBy ?? "-"}
            </div>
          ))}
          {rejectedRows.map((r) => (
            <div key={r.id} className="border rounded-lg px-3 py-2 bg-red-50 border-red-200">
              Rejected · {r.user.name} ({r.user.email}) · Reviewed {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "-"} by {r.reviewedBy ?? "-"}
            </div>
          ))}
          {approvedRows.length === 0 && rejectedRows.length === 0 && (
            <div className="text-gray-500">No reviewed requests yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
