"use client";

import { usePeriod } from "@/context/PeriodContext";
import { useGoldLoanData } from "@/context/GoldLoanDataContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";

interface TrendPoint  { date: string; ftd: number; mtd: number; }
interface BranchDisb  { branch: string; ftd: number; mtd: number; ytd: number; }
interface DisbVsColl  { mtdDisbursements: number; ytdDisbursements: number; overdueCollection: number; totalOverdue: number; }

function fmt2(n: unknown) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[0,1,2].map((i) => <div key={i} className="h-56 bg-gray-100 rounded-xl" />)}
    </div>
  );
}

export default function DisbursementSection() {
  const { period } = usePeriod();
  const { snapshot, isLoading: loading } = useGoldLoanData();
  const trend: TrendPoint[] = snapshot?.disbursementTrend ?? [];
  const branches: BranchDisb[] = snapshot?.branchDisbursement ?? [];
  const disbVsColl: DisbVsColl | null = snapshot?.disbVsCollection ?? null;

  if (loading) return <Skeleton />;

  const disbKey: keyof BranchDisb = period === "YTD" ? "ytd" : "mtd";
  const emptyMsg = <p className="text-sm text-gray-400 text-center py-10">Upload a Balance Statement to see data.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Trend */}
      <ChartCard title="Daily Disbursement Trend (\u20b9 Cr)">
        {trend.length === 0 ? emptyMsg : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`\u20b9 ${fmt2(v)} Cr`]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="ftd" stroke="#3b82f6" strokeWidth={2} dot={false} name="FTD" />
              <Line type="monotone" dataKey="mtd" stroke="#22c55e" strokeWidth={2} dot={false} name="MTD" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Branch disbursement */}
      <ChartCard title={`Disbursement by Branch (${period})`}>
        {branches.length === 0 ? emptyMsg : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={branches.slice(0, 10)}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} Cr`} />
              <YAxis type="category" dataKey="branch" tick={{ fontSize: 9 }} width={70} />
              <Tooltip formatter={(v: number) => [`\u20b9 ${fmt2(v)} Cr`, period]} />
              <Bar dataKey={disbKey} fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Disb vs Collection */}
      <ChartCard title="Disbursement vs Collection (\u20b9 Cr)">
        {!disbVsColl ? emptyMsg : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { name: "MTD Disb",      value: disbVsColl.mtdDisbursements },
                { name: "YTD Disb",      value: disbVsColl.ytdDisbursements },
                { name: "OD Collection", value: disbVsColl.overdueCollection },
                { name: "Total Overdue", value: disbVsColl.totalOverdue },
              ]}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} Cr`} />
              <Tooltip formatter={(v: number) => [`\u20b9 ${fmt2(v)} Cr`]} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
