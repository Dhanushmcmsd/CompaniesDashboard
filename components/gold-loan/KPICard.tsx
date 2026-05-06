'use client';

type Color = 'green' | 'red' | 'blue' | 'yellow';

const borderColor: Record<Color, string> = {
  green:  'border-l-green-500',
  red:    'border-l-red-500',
  blue:   'border-l-blue-500',
  yellow: 'border-l-yellow-400',
};

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  color?: Color;
  loading?: boolean;
}

export default function KPICard({ label, value, unit, color = 'blue', loading }: KPICardProps) {
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${borderColor[color]} animate-pulse`}>
        <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-7 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${borderColor[color]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}
