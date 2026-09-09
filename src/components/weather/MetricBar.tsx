/**
 * MetricBar — Visual metric with a colour-coded progress bar.
 *
 * Colour scale (semantic, tied to weather risk):
 *   value / max < 0.30  → green  (favorable)
 *   value / max < 0.60  → amber  (caution)
 *   value / max < 0.80  → orange (elevated)
 *   value / max >= 0.80 → red    (high risk)
 *
 * Override via `colorOverride` when the backend provides an explicit severity.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export type MetricColorScale = 'rain' | 'wind' | 'humidity' | 'temp' | 'inverse' | 'neutral';

interface MetricBarProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  colorScale?: MetricColorScale;
  /** Force a specific colour (from backend severity). Overrides auto scale. */
  colorOverride?: 'green' | 'amber' | 'orange' | 'red';
  size?: 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}

function getRiskColour(
  ratio: number,
  scale: MetricColorScale,
  override?: MetricBarProps['colorOverride'],
): { bar: string; text: string } {
  if (override) {
    const map: Record<string, { bar: string; text: string }> = {
      green:  { bar: 'bg-emerald-500', text: 'text-emerald-500' },
      amber:  { bar: 'bg-amber-400',   text: 'text-amber-500' },
      orange: { bar: 'bg-orange-500',  text: 'text-orange-500' },
      red:    { bar: 'bg-red-500',     text: 'text-red-500' },
    };
    return map[override] ?? { bar: 'bg-slate-400', text: 'text-slate-400' };
  }

  // For humidity / neutral → flat blue
  if (scale === 'neutral' || scale === 'humidity') {
    return { bar: 'bg-sky-400', text: 'text-sky-400' };
  }

  // Temperature — reversed risk direction for visual (high temp ≠ always bad)
  if (scale === 'temp') {
    return ratio > 0.8
      ? { bar: 'bg-orange-500', text: 'text-orange-500' }
      : ratio > 0.6
      ? { bar: 'bg-amber-400', text: 'text-amber-400' }
      : { bar: 'bg-sky-400', text: 'text-sky-400' };
  }

  // Rain / wind: higher = more risk
  if (ratio < 0.3)  return { bar: 'bg-emerald-500', text: 'text-emerald-500' };
  if (ratio < 0.6)  return { bar: 'bg-amber-400',   text: 'text-amber-400' };
  if (ratio < 0.8)  return { bar: 'bg-orange-500',  text: 'text-orange-500' };
  return              { bar: 'bg-red-500',     text: 'text-red-500' };
}

export function MetricBar({
  value,
  max = 100,
  label,
  unit = '',
  colorScale = 'rain',
  colorOverride,
  size = 'sm',
  showValue = true,
  className,
}: MetricBarProps) {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const { bar, text } = getRiskColour(ratio, colorScale, colorOverride);
  const pct = Math.round(ratio * 100);

  const trackH = size === 'md' ? 'h-2' : 'h-1.5';
  const valueSz = size === 'md' ? 'text-sm font-bold' : 'text-xs font-semibold';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-sky-text-secondary uppercase tracking-wider">{label}</span>
        {showValue && (
          <span className={cn(valueSz, text)}>
            {value}{unit}
          </span>
        )}
      </div>
      <div className={cn('w-full rounded-full bg-sky-surface-elevated overflow-hidden', trackH)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default MetricBar;
