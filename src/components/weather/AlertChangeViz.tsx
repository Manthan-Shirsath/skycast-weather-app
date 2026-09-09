/**
 * AlertChangeViz — Visualizes a forecast change event.
 *
 * Shows:
 *   OLD VALUE
 *       ↓  +Δ
 *   NEW VALUE
 *   IMPACT
 *   ACTION
 *
 * Used inside the alert panel to make the actual change visible,
 * not just say "weather update available."
 */
import React from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlertChange {
  field: string;
  prev_val: number;
  curr_val: number;
  delta: number;
  label: string;
  unit: string;
  worsened?: boolean;
}

export interface AlertRecord {
  alert_id: string;
  severity: string;
  title: string;
  location: string;
  activity?: string;
  time_display: string;
  changes: AlertChange[];
  primary_change?: AlertChange;
  recommendation: string;
  why: string;
  created_at: string;
  is_official?: boolean;
}

interface AlertChangeVizProps {
  alert: AlertRecord;
  compact?: boolean;
  className?: string;
}

const SEVERITY_THEME: Record<string, { border: string; badge: string; icon: string; header: string }> = {
  CRITICAL: {
    border: 'border-red-500/60',
    badge: 'bg-red-500 text-white',
    icon: '🔴',
    header: 'bg-red-500/10',
  },
  WARNING: {
    border: 'border-amber-500/60',
    badge: 'bg-amber-500 text-white',
    icon: '⚠️',
    header: 'bg-amber-500/10',
  },
  CAUTION: {
    border: 'border-yellow-400/60',
    badge: 'bg-yellow-400 text-slate-900',
    icon: '🟡',
    header: 'bg-yellow-400/10',
  },
  INFO: {
    border: 'border-sky-primary/40',
    badge: 'bg-sky-primary text-white',
    icon: 'ℹ️',
    header: 'bg-sky-primary/10',
  },
};

function DeltaDisplay({ change }: { change: AlertChange }) {
  const up = change.delta > 0;
  const Icon = change.delta === 0 ? Minus : up ? ArrowUp : ArrowDown;
  const deltaColour = change.worsened
    ? (change.delta > 0 ? 'text-red-500' : 'text-emerald-500')
    : 'text-sky-text-secondary';

  return (
    <div className="flex flex-col items-center gap-1 min-w-[110px]">
      {/* Old value */}
      <div className="text-center">
        <p className="text-2xl font-bold text-sky-text-secondary/60 leading-none">
          {change.prev_val}{change.unit}
        </p>
        <p className="text-[9px] text-sky-text-secondary/50 uppercase mt-0.5">Before</p>
      </div>

      {/* Arrow + delta */}
      <div className={cn('flex items-center gap-1', deltaColour)}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold">
          {change.delta > 0 ? '+' : ''}{change.delta}{change.unit}
        </span>
      </div>

      {/* New value */}
      <div className="text-center">
        <p className="text-3xl font-black text-sky-text-primary leading-none">
          {change.curr_val}{change.unit}
        </p>
        <p className="text-[9px] text-sky-text-secondary/50 uppercase mt-0.5">Now</p>
      </div>
    </div>
  );
}

export function AlertChangeViz({ alert, compact = false, className }: AlertChangeVizProps) {
  const theme = SEVERITY_THEME[alert.severity] ?? SEVERITY_THEME.INFO;
  const primary = alert.primary_change;
  const secondary = alert.changes.filter(c => c.field !== primary?.field).slice(0, 2);

  const timeStr = new Date(alert.created_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={cn('rounded-xl border overflow-hidden', theme.border, className)}>
      {/* Header */}
      <div className={cn('px-3 py-2 flex items-center justify-between gap-2', theme.header)}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-text-primary flex items-center gap-1.5">
            {theme.icon} {alert.title}
          </p>
          <p className="text-[10px] text-sky-text-secondary mt-0.5">
            {alert.location}
            {alert.activity && ` · ${alert.activity}`}
            {` · ${alert.time_display}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', theme.badge)}>
            {alert.severity}
          </span>
          <span className="text-[9px] text-sky-text-secondary">{timeStr}</span>
        </div>
      </div>

      {/* Change visualization */}
      {primary && (
        <div className="px-4 py-3 flex items-center gap-4 border-b border-sky-border/30">
          <DeltaDisplay change={primary} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sky-text-primary">{primary.label}</p>
            <p className="text-[11px] text-sky-text-secondary mt-1 leading-snug">{alert.why}</p>
            {secondary.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {secondary.map((c, i) => (
                  <span key={i} className="text-[10px] text-sky-text-secondary bg-sky-surface-elevated px-2 py-0.5 rounded-full">
                    {c.label}: {c.prev_val}→{c.curr_val}{c.unit}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {alert.recommendation && (
        <div className="px-3 py-2 bg-sky-surface-elevated/50">
          <p className="text-[11px] font-medium text-sky-text-primary">
            → {alert.recommendation}
          </p>
        </div>
      )}

      {/* Official disclaimer */}
      {!alert.is_official && (
        <p className="text-[9px] text-sky-text-secondary/40 px-3 pb-2 pt-1">
          SkyCast forecast-change alert · not an official weather warning
        </p>
      )}
    </div>
  );
}

export default AlertChangeViz;
