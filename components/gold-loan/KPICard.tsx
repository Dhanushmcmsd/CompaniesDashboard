"use client";

type CardColor = "green" | "red" | "blue" | "yellow";

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  color?: CardColor;
  loading?: boolean;
}

const borderColor: Record<CardColor, string> = {
  green: "border-l-4 border-l-green-500",
  red: "border-l-4 border-l-red-500",
  blue: "border-l-4 border-l-blue-500",
  yellow: "border-l-4 border-l-yellow-400",
};

export default function KPICard({ label, value, unit, color, loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="h-7 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-4 border border-gray-100 ${
        color ? borderColor[color] : ""
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0f172a] leading-none">
        {value}
        {unit && (
          <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
        )}
      </p>
    </div>
  );
}
