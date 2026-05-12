'use client';

import { useState } from 'react';

type Color = 'blue' | 'green' | 'yellow' | 'red';

interface Drilldown {
  label: string;
  value: string;
}

interface Props {
  label:       string;
  value:       string;
  unit?:       string;
  color?:      Color;
  loading?:    boolean;
  description?: string;
  drilldown?:  Drilldown[];
}

const COLOR_MAP: Record<Color, { badge: string; dot: string }> = {
  blue:   { badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  green:  { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  red:    { badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
};

export default function MfKPICard({
  label, value, unit, color = 'blue', loading = false, description, drilldown,
}: Props) {
  const [open, setOpen] = useState(false);
  const { badge, dot } = COLOR_MAP[color];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
      </div>

      {loading ? (
        <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[#1a2340]">{value}</span>
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
        </div>
      )}

      {open && !loading && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {description && (
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{description}</p>
          )}
          {drilldown?.map((d) => (
            <div key={d.label} className="flex justify-between text-xs">
              <span className="text-gray-500">{d.label}</span>
              <span className={`font-medium px-1.5 py-0.5 rounded ${badge}`}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
