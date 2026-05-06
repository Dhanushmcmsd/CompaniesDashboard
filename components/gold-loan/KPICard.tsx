'use client';

import { useState } from 'react';

type Color = 'green' | 'red' | 'blue' | 'yellow';

const borderColor: Record<Color, string> = {
  green:  'border-l-green-500',
  red:    'border-l-red-500',
  blue:   'border-l-blue-500',
  yellow: 'border-l-yellow-400',
};

const badgeBg: Record<Color, string> = {
  green:  'bg-green-50 text-green-700',
  red:    'bg-red-50 text-red-700',
  blue:   'bg-blue-50 text-blue-700',
  yellow: 'bg-yellow-50 text-yellow-700',
};

interface DrillItem { label: string; value: string }

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  color?: Color;
  loading?: boolean;
  // Full precision value shown on hover tooltip
  fullValue?: string | number;
  // Extra rows shown in the drilldown modal on click
  drilldown?: DrillItem[];
  // Optional description shown in modal
  description?: string;
}

export default function KPICard({
  label, value, unit, color = 'blue', loading,
  fullValue, drilldown, description,
}: KPICardProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${borderColor[color]} animate-pulse`}>
        <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-7 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  const hasDetail = !!(fullValue !== undefined || drilldown?.length || description);
  const tooltipText = fullValue !== undefined ? String(fullValue) : null;

  return (
    <>
      {/* Card */}
      <div
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={hasDetail ? (e) => e.key === 'Enter' && setOpen(true) : undefined}
        onClick={hasDetail ? () => setOpen(true) : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          relative bg-white rounded-lg shadow p-4 border-l-4 ${borderColor[color]}
          transition-all duration-150
          ${hasDetail ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-95' : ''}
        `}
      >
        {/* Expand hint icon */}
        {hasDetail && (
          <span className="absolute top-2 right-2 text-gray-300 text-xs select-none">
            &#x26F6;
          </span>
        )}

        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 pr-4">{label}</p>
        <p className="text-2xl font-bold text-gray-800">
          {value}
          {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
        </p>

        {/* Hover tooltip showing full precision value */}
        {hovered && tooltipText && (
          <div className="
            absolute z-20 left-1/2 -translate-x-1/2 -top-9
            bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5
            whitespace-nowrap shadow-lg pointer-events-none
          ">
            {tooltipText}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
              border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Drilldown Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${badgeBg[color]}`}>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold opacity-60">{label}</p>
                <p className="text-3xl font-bold mt-0.5">
                  {value}
                  {unit && <span className="text-base font-normal opacity-60 ml-1">{unit}</span>}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl leading-none opacity-40 hover:opacity-80 transition-opacity"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {description && (
                <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
              )}

              {fullValue !== undefined && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Full Precision</span>
                  <span className="text-sm font-semibold text-gray-800 font-mono">{fullValue}{unit ? ` ${unit}` : ''}</span>
                </div>
              )}

              {drilldown?.map((row, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
