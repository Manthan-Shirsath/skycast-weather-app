/**
 * DecisionHero — Visually dominant decision card.
 *
 * Replaces the existing minimal text-grid decision card.
 * Shows:
 *   - Activity name + emoji
 *   - Location · date · time
 *   - Risk verdict (dominant, colour-coded)
 *   - Primary metric (large number + MetricBar)
 *   - Supporting metrics row
 *   - Expandable "Why SkyCast says this" evidence section
 *   - Forecast chart (if hourly slots available)
 *   - Decision windows
 *   - Recommendation box
 *
 * All data comes from the existing `decision` card payload —
 * no new API calls, no computed values invented here.
 */
import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Thermometer, Droplets, Wind, CloudRain,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { MetricBar } from './MetricBar';
import { ForecastChart } from './ForecastChart';
import { DecisionWindows } from './DecisionWindows';

// ── Activity emoji map ───────────────────────────────────────────────────────
const ACTIVITY_EMOJI: Record<string, string> = {
  cricket:    '🏏',
  football:   '⚽',
  soccer:     '⚽',
  baseball:   '⚾',
  tennis:     '🎾',
  golf:       '⛳',
  running:    '🏃',
  cycling:    '🚴',
  hiking:     '🥾',
  farming:    '🌾',
  spraying:   '🌿',
  pesticide:  '🌿',
  irrigation: '💧',
  agriculture:'🌾',
  harvest:    '🌾',
  travel:     '🚗',
  driving:    '🚗',
  flight:     '✈️',
  event:      '🎪',
  outdoor:    '🌳',
  picnic:     '🧺',
  wedding:    '💒',
  marathon:   '🏃',
  swimming:   '🏊',
  default:    '🌤️',
};

function getActivityEmoji(activity?: string): string {
  if (!activity) return ACTIVITY_EMOJI.default;
  const lower = activity.toLowerCase();
  for (const [key, emoji] of Object.entries(ACTIVITY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return ACTIVITY_EMOJI.default;
}

// ── Risk verdict config ──────────────────────────────────────────────────────
type RiskLevel = 'safe' | 'marginal' | 'unsafe' | 'critical';

interface VerdictConfig {
  label: string;
  sublabel: string;
  headerBg: string;
  headerText: string;
  accentBorder: string;
  icon: string;
}

const VERDICT: Record<RiskLevel, VerdictConfig> = {
  safe: {
    label: 'GOOD TO GO',
    sublabel: 'Conditions are favorable',
    headerBg: 'from-emerald-500/15 to-emerald-500/5',
    headerText: 'text-emerald-500',
    accentBorder: 'border-emerald-500/40',
    icon: '✅',
  },
  marginal: {
    label: 'USE CAUTION',
    sublabel: 'Conditions are uncertain',
    headerBg: 'from-amber-400/15 to-amber-400/5',
    headerText: 'text-amber-500',
    accentBorder: 'border-amber-400/40',
    icon: '🟠',
  },
  unsafe: {
    label: 'HIGH RISK',
    sublabel: 'Not recommended',
    headerBg: 'from-red-500/15 to-red-500/5',
    headerText: 'text-red-500',
    accentBorder: 'border-red-500/40',
    icon: '⚠️',
  },
  critical: {
    label: 'CRITICAL RISK',
    sublabel: 'Severe conditions expected',
    headerBg: 'from-red-700/20 to-red-700/5',
    headerText: 'text-red-600',
    accentBorder: 'border-red-600/60',
    icon: '🔴',
  },
};

function getRiskLevel(data: any): RiskLevel {
  const status = (data.status ?? '').toLowerCase();
  const colour = (data.risk_colour ?? '').toLowerCase();
  const isSuitable = data.is_suitable;

  if (status === 'critical' || colour === 'purple') return 'critical';
  if (status === 'unfavorable' || colour === 'red' || isSuitable === false) return 'unsafe';
  if (status === 'marginal' || colour === 'yellow' || colour === 'orange') return 'marginal';
  if (status === 'favorable' || colour === 'green' || isSuitable === true) return 'safe';

  // Fall back on rain probability
  const rain = data.precipitation_probability ?? 0;
  if (rain >= 70) return 'unsafe';
  if (rain >= 40) return 'marginal';
  return 'safe';
}

// ── Condition emoji ──────────────────────────────────────────────────────────
function conditionEmoji(cond?: string): string {
  if (!cond) return '🌤️';
  const c = cond.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('heavy rain') || c.includes('torrential')) return '🌧️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌦️';
  if (c.includes('overcast') || c.includes('cloud')) return '☁️';
  if (c.includes('fog') || c.includes('mist')) return '🌫️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('clear') || c.includes('sunny')) return '☀️';
  if (c.includes('partly')) return '⛅';
  return '🌤️';
}

// ── Component ────────────────────────────────────────────────────────────────
interface DecisionHeroProps {
  data: any;
  onMonitor?: (opts: {
    location: string;
    activity?: string;
    target_hour?: number;
    time_label?: string;
    target_date?: string;
  }) => void;
  isMonitoring?: boolean;
  monitoringBusy?: boolean;
  onStopMonitor?: () => void;
  onRefreshMonitor?: () => void;
}

export function DecisionHero({
  data,
  onMonitor,
  isMonitoring,
  monitoringBusy,
  onStopMonitor,
  onRefreshMonitor,
}: DecisionHeroProps) {
  const [showWhy, setShowWhy] = useState(false);

  const risk     = getRiskLevel(data);
  const verdict  = VERDICT[risk];
  const activity = data.activity || data.user_activity || 'Activity';
  const emoji    = getActivityEmoji(activity);
  const location = data.location || 'Location';
  const timeStr  = data.target_time || data.time_range || 'Today';
  const rain     = data.precipitation_probability ?? data.rain_chance_pct ?? 0;
  const temp     = data.temperature_c ?? data.temperature ?? null;
  const wind     = data.wind_speed_kmh ?? data.wind ?? null;
  const humidity = data.humidity ?? null;
  const precip   = data.expected_rainfall_mm ?? data.precipitation_mm ?? null;
  const reason   = data.reason || data.explanation || '';
  const rec      = data.recommendation || '';
  const cond     = data.condition || '';
  const condEmoji = conditionEmoji(cond);

  // Slots for chart and decision windows
  const slots: any[] = data.hourly_forecast
    || (data.target_period?.slots ?? [])
    || [];

  // Parse target hour for chart event marker
  let targetHour: number | undefined;
  const tStr = data.target_time || '';
  const tMatch = tStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tMatch) {
    let h = parseInt(tMatch[1], 10);
    const mer = (tMatch[3] ?? '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24) targetHour = h;
  }
  if (targetHour == null && data.target_hour != null) {
    targetHour = data.target_hour;
  }

  // Analytics
  const analytics = data.analytics;
  const stabilityLabel = analytics?.stability_reason || analytics?.forecast_stability;
  const bestDry = analytics?.best_dry_window;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden w-full max-w-sm shadow-md animate-fade-slide-in',
      verdict.accentBorder,
    )}>
      {/* ── Hero Header ────────────────────────────────────────────── */}
      <div className={cn('px-4 pt-4 pb-3 bg-gradient-to-b', verdict.headerBg)}>
        {/* Activity row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-xs text-sky-text-secondary/70 uppercase tracking-widest font-semibold">
              {emoji} {activity.toUpperCase()}
            </p>
            <p className="text-[11px] text-sky-text-secondary mt-0.5 flex items-center gap-1">
              📍 {location}
              {timeStr && <> · {timeStr}</>}
            </p>
          </div>
          <span className="text-lg leading-none">{condEmoji}</span>
        </div>

        {/* Verdict */}
        <div className={cn('text-2xl font-black tracking-tight leading-none', verdict.headerText)}>
          {verdict.icon} {verdict.label}
        </div>
        <p className="text-[11px] text-sky-text-secondary mt-0.5">{verdict.sublabel}</p>
      </div>

      {/* ── Primary Metric ─────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-sky-border/30 bg-sky-surface">
        <div className="flex items-end gap-4 mb-3">
          <div>
            <p className={cn('text-5xl font-black leading-none', risk === 'safe' ? 'text-emerald-500' : risk === 'marginal' ? 'text-amber-500' : 'text-red-500')}>
              {rain}<span className="text-2xl">%</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-sky-text-secondary font-semibold mt-1 flex items-center gap-1">
              <CloudRain className="h-3 w-3" /> Today's Rain Probability
            </p>
          </div>
          <div className="flex-1 pb-1">
            <MetricBar
              value={rain}
              label=""
              unit="%"
              colorScale="rain"
              size="md"
              showValue={false}
            />
          </div>
        </div>

        {/* Supporting metrics */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sky-border/30">
          {temp != null && (
            <div className="text-center">
              <Thermometer className="h-3.5 w-3.5 text-sky-text-secondary mx-auto mb-0.5" />
              <p className="text-sm font-bold text-sky-text-primary">{temp}°</p>
              <p className="text-[9px] text-sky-text-secondary uppercase">Temp</p>
            </div>
          )}
          {humidity != null && (
            <div className="text-center">
              <Droplets className="h-3.5 w-3.5 text-sky-text-secondary mx-auto mb-0.5" />
              <p className="text-sm font-bold text-sky-text-primary">{humidity}%</p>
              <p className="text-[9px] text-sky-text-secondary uppercase">Humidity</p>
            </div>
          )}
          {wind != null && (
            <div className="text-center">
              <Wind className="h-3.5 w-3.5 text-sky-text-secondary mx-auto mb-0.5" />
              <p className="text-sm font-bold text-sky-text-primary">{wind}</p>
              <p className="text-[9px] text-sky-text-secondary uppercase">km/h</p>
            </div>
          )}
          {precip != null && (
            <div className="text-center">
              <CloudRain className="h-3.5 w-3.5 text-sky-text-secondary mx-auto mb-0.5" />
              <p className="text-sm font-bold text-sky-text-primary">{precip}mm</p>
              <p className="text-[9px] text-sky-text-secondary uppercase">Precip</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Forecast Chart ─────────────────────────────────────────── */}
      {slots.length > 1 && (
        <div className="px-3 py-2 border-t border-sky-border/30 bg-sky-surface">
          <ForecastChart
            slots={slots}
            eventHour={targetHour}
            location={location}
            nwpModel={data.nwp_model}
          />
        </div>
      )}

      {/* ── Decision Windows ───────────────────────────────────────── */}
      {slots.length > 1 && (
        <div className="px-4 py-3 border-t border-sky-border/30 bg-sky-surface">
          <DecisionWindows slots={slots} activity={activity} />
        </div>
      )}

      {/* ── Why? (expandable) ──────────────────────────────────────── */}
      {(reason || stabilityLabel || bestDry || analytics) && (
        <div className="border-t border-sky-border/30">
          <button
            onClick={() => setShowWhy(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-sky-text-secondary hover:text-sky-text-primary hover:bg-sky-surface-elevated/50 transition-colors"
          >
            <span className="uppercase tracking-wider">Why SkyCast says this</span>
            {showWhy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showWhy && (
            <div className="px-4 pb-3 bg-sky-surface-elevated/30 space-y-2 animate-fade-in">
              {rain > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-text-secondary flex items-center gap-1.5">
                    <CloudRain className="h-3 w-3" /> Today's Rain Prob
                  </span>
                  <span className={cn('font-bold', rain >= 60 ? 'text-red-500' : rain >= 30 ? 'text-amber-500' : 'text-emerald-500')}>
                    {rain}% {rain >= 60 ? '↑↑' : rain >= 30 ? '↑' : ''}
                  </span>
                </div>
              )}
              {precip != null && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-text-secondary flex items-center gap-1.5">
                    <Droplets className="h-3 w-3" /> Expected rainfall
                  </span>
                  <span className="font-bold text-sky-text-primary">{precip} mm</span>
                </div>
              )}
              {wind != null && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-text-secondary flex items-center gap-1.5">
                    <Wind className="h-3 w-3" /> Wind speed
                  </span>
                  <span className={cn('font-bold', (wind ?? 0) >= 35 ? 'text-amber-500' : 'text-sky-text-primary')}>
                    {wind} km/h
                  </span>
                </div>
              )}
              {temp != null && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-sky-text-secondary flex items-center gap-1.5">
                    <Thermometer className="h-3 w-3" /> Temperature
                  </span>
                  <span className="font-bold text-sky-text-primary">{temp}°C</span>
                </div>
              )}
              {stabilityLabel && (
                <div className="pt-1 border-t border-sky-border/30">
                  <p className="text-[10px] text-sky-text-secondary uppercase tracking-wider">Forecast stability</p>
                  <p className="text-xs text-sky-text-primary mt-0.5 capitalize">{stabilityLabel}</p>
                </div>
              )}
              {reason && (
                <div className="pt-1 border-t border-sky-border/30">
                  <p className="text-xs text-sky-text-secondary leading-snug">{reason}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recommendation ─────────────────────────────────────────── */}
      {rec && (
        <div className="px-4 py-3 border-t border-sky-border/30 bg-sky-surface-elevated/40">
          <p className="text-[10px] uppercase tracking-widest text-sky-text-secondary font-semibold mb-1">
            💡 Recommendation
          </p>
          <p className="text-sm font-medium text-sky-text-primary leading-snug">{rec}</p>
        </div>
      )}

      {/* ── Monitor Action ─────────────────────────────────────────── */}
      {onMonitor && (
        <div className="px-4 py-2.5 border-t border-sky-border/30 bg-sky-surface">
          {isMonitoring ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sky-ai">
                <span className="h-2 w-2 rounded-full bg-sky-ai animate-pulse" />
                <span className="font-semibold">Monitoring {location}</span>
              </div>
              <div className="flex items-center gap-2">
                {onRefreshMonitor && (
                  <button
                    onClick={onRefreshMonitor}
                    disabled={monitoringBusy}
                    className="text-[10px] font-semibold text-sky-ai hover:text-sky-primary border border-sky-ai/30 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
                  >
                    {monitoringBusy ? '...' : '↺ Refresh'}
                  </button>
                )}
                {onStopMonitor && (
                  <button
                    onClick={onStopMonitor}
                    className="text-[10px] font-semibold text-sky-text-secondary hover:text-red-400 transition-colors"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => onMonitor({
                location,
                activity,
                target_hour: targetHour,
                time_label: data.time_range?.toLowerCase() || undefined,
                target_date: data.target_date || undefined,
              })}
              disabled={monitoringBusy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-sky-ai/10 hover:bg-sky-ai/20 border border-sky-ai/20 hover:border-sky-ai/40 text-sky-ai text-xs font-semibold transition-all disabled:opacity-50"
            >
              🔔 Monitor this
            </button>
          )}
        </div>
      )}

      {/* Data source */}
      <p className="text-[9px] text-sky-text-secondary/40 px-4 pb-2 pt-1">
        {data.nwp_model || 'GFS'} · Open-Meteo · SkyCast Intelligence
      </p>
    </div>
  );
}

export default DecisionHero;
