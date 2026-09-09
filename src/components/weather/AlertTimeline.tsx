/**
 * AlertTimeline — Vertical timeline of monitoring events.
 *
 * Shows:
 *   🟢 Monitoring started — 10:30 AM
 *   🟡 Rain risk increased — 12:00 PM — 30% → 55%
 *   🔴 High rain risk — 1:30 PM — 55% → 78%
 *
 * Compact by design. Not a full notification center.
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface AlertRecord {
  alert_id: string;
  severity: string;
  title: string;
  location: string;
  time_display: string;
  primary_change?: {
    label: string;
    prev_val: number;
    curr_val: number;
    unit: string;
  };
  created_at: string;
}

interface AlertTimelineProps {
  alerts: AlertRecord[];
  monitorCreatedAt?: string;
  className?: string;
}

const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  WARNING:  'bg-amber-500',
  CAUTION:  'bg-yellow-400',
  INFO:     'bg-sky-primary',
};

const SEV_EMOJI: Record<string, string> = {
  CRITICAL: '🔴',
  WARNING:  '⚠️',
  CAUTION:  '🟡',
  INFO:     'ℹ️',
};

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AlertTimeline({ alerts, monitorCreatedAt, className }: AlertTimelineProps) {
  // Build combined event list (start + alerts)
  type Event =
    | { kind: 'start'; ts: string }
    | { kind: 'alert'; data: AlertRecord };

  const events: Event[] = [];

  if (monitorCreatedAt) {
    events.push({ kind: 'start', ts: monitorCreatedAt });
  }

  // alerts are newest-first; reverse for timeline display
  [...alerts].reverse().forEach(a => events.push({ kind: 'alert', data: a }));

  if (events.length === 0) return null;

  return (
    <div className={cn('space-y-0', className)}>
      <p className="text-[10px] uppercase tracking-widest text-sky-text-secondary font-semibold mb-3">
        Monitor History
      </p>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-sky-border/40" />

        <div className="space-y-3 pl-6">
          {events.map((ev, i) => {
            if (ev.kind === 'start') {
              return (
                <div key="start" className="relative">
                  <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-sky-surface" />
                  <p className="text-[11px] font-medium text-emerald-500">🟢 Monitoring started</p>
                  <p className="text-[10px] text-sky-text-secondary">{timeStr(ev.ts)}</p>
                </div>
              );
            }

            const a = ev.data;
            const dot = SEV_DOT[a.severity] ?? 'bg-slate-400';
            const emoji = SEV_EMOJI[a.severity] ?? 'ℹ️';
            const pc = a.primary_change;

            return (
              <div key={a.alert_id} className="relative">
                <div className={cn('absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full border-2 border-sky-surface', dot)} />
                <p className="text-[11px] font-medium text-sky-text-primary">
                  {emoji} {a.title}
                </p>
                <p className="text-[10px] text-sky-text-secondary">
                  {timeStr(a.created_at)}
                  {pc && ` · ${pc.label}: ${pc.prev_val}→${pc.curr_val}${pc.unit}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AlertTimeline;
