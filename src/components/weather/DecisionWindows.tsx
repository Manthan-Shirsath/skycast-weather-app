/**
 * DecisionWindows — Deterministic time-window grouping from hourly forecast data.
 *
 * Groups consecutive hours into risk windows using the same thresholds
 * as the backend alert engine. This is purely a frontend presentation
 * layer — no new business logic, no LLM-invented windows.
 *
 * Risk levels (matching MetricBar colour scale):
 *   GOOD     → rain < 30% AND wind < 20 km/h
 *   CAUTION  → rain 30–59% OR wind 20–39 km/h
 *   HIGH     → rain ≥ 60% OR wind ≥ 40 km/h
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface HourSlot {
  hour?: number;
  time?: string | number;
  precipitation_probability?: number;
  rainChance?: number;
  wind_speed_kmh?: number;
  windSpeed?: number;
  temperature_c?: number;
  tempC?: number;
}

interface TimeWindow {
  start: number;    // hour (0-23)
  end: number;
  risk: 'good' | 'caution' | 'high';
  maxRain: number;
  maxWind: number;
  label: string;
}

interface DecisionWindowsProps {
  slots: HourSlot[];
  activity?: string;
  className?: string;
}

function getHour(s: HourSlot): number {
  if (s.hour != null) return s.hour;
  const t = String(s.time ?? '');
  if (t.includes(':')) return parseInt(t.split(':')[0], 10);
  return parseInt(t, 10) || 0;
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function classifyRisk(rain: number, wind: number): TimeWindow['risk'] {
  if (rain >= 60 || wind >= 40) return 'high';
  if (rain >= 30 || wind >= 20) return 'caution';
  return 'good';
}

function buildWindows(slots: HourSlot[]): TimeWindow[] {
  if (!slots.length) return [];

  const windows: TimeWindow[] = [];
  let current: TimeWindow | null = null;

  for (const slot of slots) {
    const h    = getHour(slot);
    const rain = slot.precipitation_probability ?? slot.rainChance ?? 0;
    const wind = slot.wind_speed_kmh ?? slot.windSpeed ?? 0;
    const risk = classifyRisk(rain, wind);

    if (!current || current.risk !== risk) {
      if (current) windows.push({ ...current, end: h - 1 });
      current = { start: h, end: h, risk, maxRain: rain, maxWind: wind, label: '' };
    } else {
      current.maxRain = Math.max(current.maxRain, rain);
      current.maxWind = Math.max(current.maxWind, wind);
      current.end = h;
    }
  }
  if (current) windows.push(current);

  return windows;
}

const RISK_CONFIG: Record<TimeWindow['risk'], {
  dot: string;
  bg: string;
  border: string;
  text: string;
  label: string;
}> = {
  good:    { dot: 'bg-emerald-500', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20', text: 'text-emerald-500', label: 'Good conditions' },
  caution: { dot: 'bg-amber-400',   bg: 'bg-amber-400/8',    border: 'border-amber-400/20',   text: 'text-amber-500',  label: 'Moderate conditions' },
  high:    { dot: 'bg-red-500',     bg: 'bg-red-500/8',      border: 'border-red-500/20',     text: 'text-red-500',    label: 'High rain risk' },
};

export function DecisionWindows({ slots, activity, className }: DecisionWindowsProps) {
  const windows = buildWindows(slots);
  if (windows.length === 0) return null;

  const bestWindow = windows
    .filter(w => w.risk === 'good')
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] uppercase tracking-widest text-sky-text-secondary font-semibold">
        Decision Windows{activity ? ` · ${activity}` : ''}
      </p>

      <div className="space-y-1.5">
        {windows.map((w, i) => {
          const cfg = RISK_CONFIG[w.risk];
          const isBest = bestWindow && w === bestWindow;
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
                cfg.bg, cfg.border,
                isBest && 'ring-1 ring-emerald-500/30',
              )}
            >
              <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', cfg.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-sky-text-primary">
                    {formatHour(w.start)}
                    {w.end !== w.start && ` – ${formatHour(w.end + 1)}`}
                  </span>
                  {isBest && (
                    <span className="text-[9px] uppercase font-bold text-emerald-500 tracking-wider">
                      Best window
                    </span>
                  )}
                </div>
                <p className={cn('text-[11px]', cfg.text)}>{cfg.label}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-sky-text-secondary">
                  🌧 {Math.round(w.maxRain)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {bestWindow && (
        <div className="pt-1 border-t border-sky-border/30">
          <p className="text-[11px] text-emerald-500 font-medium">
            ✓ Best window: {formatHour(bestWindow.start)}
            {bestWindow.end !== bestWindow.start && ` – ${formatHour(bestWindow.end + 1)}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default DecisionWindows;
