/**
 * ForecastChart — Pure-SVG responsive forecast visualizer.
 *
 * Renders a line chart for rain probability, temperature, or wind
 * from the existing `hourly_forecast` or `hourlySeries` payload.
 * No external charting library.
 *
 * Features:
 *  - Metric tab switcher (Rain / Temp / Wind)
 *  - Event time marker (vertical dashed line + "YOUR EVENT" label)
 *  - Colour-coded fill under the curve (green → amber → red by value)
 *  - Responsive via SVG viewBox
 *  - Data freshness note
 */
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HourSlot {
  hour?: number;
  time?: string | number;
  time_iso?: string;
  precipitation_probability?: number;
  rainChance?: number;
  rain_chance_pct?: number;
  temperature_c?: number;
  tempC?: number;
  wind_speed_kmh?: number;
  windSpeed?: number;
  wind_speed_10m?: number;
}

interface ForecastChartProps {
  slots: HourSlot[];
  eventHour?: number;          // 0-23, marks the user's event time
  targetDate?: string;
  location?: string;
  nwpModel?: string;
  className?: string;
}

type Metric = 'rain' | 'temp' | 'wind';

const METRIC_CONFIG: Record<Metric, {
  label: string;
  unit: string;
  max: number;
  getter: (s: HourSlot) => number | undefined;
  goodBelow: number;  // below this value = green fill
  badAbove: number;   // above this value = red fill
}> = {
  rain: {
    label: 'Rain %',
    unit: '%',
    max: 100,
    getter: s => s.precipitation_probability ?? s.rainChance ?? s.rain_chance_pct,
    goodBelow: 30,
    badAbove: 60,
  },
  temp: {
    label: 'Temp',
    unit: '°C',
    max: 45,
    getter: s => s.temperature_c ?? s.tempC,
    goodBelow: 30,
    badAbove: 38,
  },
  wind: {
    label: 'Wind',
    unit: ' km/h',
    max: 80,
    getter: s => s.wind_speed_kmh ?? s.windSpeed ?? s.wind_speed_10m,
    goodBelow: 20,
    badAbove: 40,
  },
};

function getHour(slot: HourSlot): number {
  if (slot.hour != null) return slot.hour;
  if (slot.time != null) {
    const t = String(slot.time);
    if (t.includes(':')) return parseInt(t.split(':')[0], 10);
    return parseInt(t, 10);
  }
  if (slot.time_iso) return new Date(slot.time_iso).getHours();
  return 0;
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function valueToColour(val: number, cfg: typeof METRIC_CONFIG[Metric]): string {
  if (val < cfg.goodBelow) return '#10b981';  // emerald
  if (val < cfg.badAbove)  return '#f59e0b';  // amber
  return '#ef4444';                            // red
}

export function ForecastChart({
  slots,
  eventHour,
  location,
  nwpModel,
  className,
}: ForecastChartProps) {
  const [metric, setMetric] = useState<Metric>('rain');
  const cfg = METRIC_CONFIG[metric];

  // Limit to a reasonable window (max 12 slots)
  const displaySlots = useMemo(() => {
    if (!slots?.length) return [];
    const valid = slots.filter(s => cfg.getter(s) != null);
    if (valid.length === 0) return [];
    // If event hour is provided, centre a 7-hour window around it
    if (eventHour != null) {
      const lo = eventHour - 3;
      const hi = eventHour + 4;
      const inWindow = valid.filter(s => { const h = getHour(s); return h >= lo && h <= hi; });
      if (inWindow.length > 1) return inWindow;
    }
    return valid.slice(0, 12);
  }, [slots, metric, eventHour]);

  if (!displaySlots.length) return null;

  // SVG dimensions
  const W = 400;
  const H = 120;
  const PAD = { top: 16, right: 16, bottom: 28, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const values = displaySlots.map(s => cfg.getter(s) as number);
  const hours  = displaySlots.map(getHour);
  const maxVal = Math.max(...values, cfg.max * 0.3);  // ensure chart isn't flat at 0
  const effectiveMax = Math.min(maxVal * 1.15, cfg.max);

  const xScale = (i: number) => PAD.left + (i / Math.max(displaySlots.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (Math.min(v, cfg.max) / effectiveMax) * chartH;

  // Build polyline points
  const points = displaySlots.map((_, i) => `${xScale(i)},${yScale(values[i])}`).join(' ');

  // Build filled area path
  const firstX = xScale(0);
  const lastX  = xScale(displaySlots.length - 1);
  const baseY  = PAD.top + chartH;
  const areaPath = `M${firstX},${baseY} ` +
    displaySlots.map((_, i) => `L${xScale(i)},${yScale(values[i])}`).join(' ') +
    ` L${lastX},${baseY} Z`;

  // Event marker
  const eventIdx = eventHour != null ? displaySlots.findIndex(s => getHour(s) === eventHour) : -1;
  const eventX   = eventIdx >= 0 ? xScale(eventIdx) : null;

  // Peak value and its colour
  const peakVal = Math.max(...values);
  const peakColour = valueToColour(peakVal, cfg);

  // Y-axis labels (3 ticks)
  const yTicks = [0, Math.round(effectiveMax / 2), Math.round(effectiveMax)];

  return (
    <div className={cn('rounded-xl bg-sky-surface border border-sky-border/50 overflow-hidden', className)}>
      {/* Metric tabs */}
      <div className="flex border-b border-sky-border/50">
        {(['rain', 'temp', 'wind'] as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
              metric === m
                ? 'bg-sky-surface-elevated text-sky-text-primary border-b-2 border-sky-primary'
                : 'text-sky-text-secondary hover:text-sky-text-primary',
            )}
          >
            {METRIC_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="px-1 pt-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 130 }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`fill-grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={peakColour} stopOpacity="0.25" />
              <stop offset="100%" stopColor={peakColour} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={PAD.left} y1={yScale(tick)}
                x2={W - PAD.right} y2={yScale(tick)}
                stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
              />
              <text
                x={PAD.left - 4} y={yScale(tick) + 3.5}
                textAnchor="end" fontSize="8" fill="currentColor" opacity="0.4"
              >
                {tick}{cfg.unit === '%' ? '' : ''}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#fill-grad-${metric})`} />

          {/* Event marker */}
          {eventX != null && (
            <g>
              <line
                x1={eventX} y1={PAD.top}
                x2={eventX} y2={PAD.top + chartH}
                stroke={peakColour} strokeWidth="1.5"
                strokeDasharray="4 3" strokeOpacity="0.8"
              />
              <text
                x={eventX} y={PAD.top - 3}
                textAnchor="middle" fontSize="7.5"
                fill={peakColour} fontWeight="700" opacity="0.9"
              >
                EVENT
              </text>
            </g>
          )}

          {/* Polyline */}
          <polyline
            points={points}
            fill="none"
            stroke={peakColour}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {displaySlots.map((_, i) => (
            <circle
              key={i}
              cx={xScale(i)} cy={yScale(values[i])} r="2.5"
              fill={valueToColour(values[i], cfg)}
              stroke="var(--surface)" strokeWidth="1"
            />
          ))}

          {/* X-axis labels */}
          {displaySlots.map((_, i) => {
            // Only show every other label to avoid crowding
            if (displaySlots.length > 6 && i % 2 !== 0) return null;
            return (
              <text
                key={i}
                x={xScale(i)} y={H - 4}
                textAnchor="middle" fontSize="8"
                fill="currentColor" opacity="0.5"
              >
                {formatHour(hours[i])}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      {(location || nwpModel) && (
        <p className="text-[9px] text-sky-text-secondary px-3 pb-2 pt-0 opacity-60">
          {location && <span>{location} · </span>}
          {nwpModel || 'GFS'} via Open-Meteo
        </p>
      )}
    </div>
  );
}

export default ForecastChart;
