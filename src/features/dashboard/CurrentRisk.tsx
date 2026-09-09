import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ShieldCheck, ShieldAlert, Sun, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CurrentRiskProps {
  isLoading: boolean;
  current: any;
  alerts: any[];
}

export function CurrentRisk({ isLoading, current, alerts }: CurrentRiskProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <section className="space-y-5 h-full">
        <h2 className="text-2xl font-bold text-sky-text-primary tracking-tight">{t('home.current_risk', 'Current Risk Level')}</h2>
        <Skeleton className="h-[340px] w-full rounded-[2rem]" />
      </section>
    );
  }

  const hasAlerts = alerts && alerts.length > 0;
  const riskLevel = hasAlerts ? t('home.high_risk', 'High Risk') : t('home.low_risk', 'Low Risk');
  const RiskIcon = hasAlerts ? ShieldAlert : ShieldCheck;
  const isLow = !hasAlerts;

  const getUILabel = (uv: number) => {
    if (uv < 3) return '(Low)';
    if (uv < 6) return '(Moderate)';
    if (uv < 8) return '(High)';
    if (uv < 11) return '(Very High)';
    return '(Extreme)';
  };
  
  const getUVProgress = (uv: number) => {
    return Math.min(100, (uv / 11) * 100);
  };
  
  const uvValue = current?.uvi ?? 0;
  const visibilityVal = current?.visibility ?? 10000;

  return (
    <section className="space-y-5 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-sky-text-primary tracking-tight">{t('home.risk_analysis', 'Risk Analysis')}</h2>
      
      <div className="glass-card rounded-[2rem] overflow-hidden flex-1 flex flex-col relative group">
        
        {/* Dynamic Glow Background */}
        <div className={cn(
          "absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000", 
          isLow ? "bg-emerald-500" : "bg-red-500"
        )} />
        <div className={cn(
          "absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000", 
          isLow ? "bg-sky-primary" : "bg-orange-500"
        )} />
        
        <div className="p-8 flex-1 flex flex-col z-10">
          {/* Top badge area */}
          <div className="flex items-center justify-between mb-8">
            <div className={cn(
              "flex items-center space-x-2 px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest shadow-sm",
              isLow 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse-slow"
            )}>
              <RiskIcon className="h-4 w-4" />
              <span>{riskLevel}</span>
              <span className={cn("h-2 w-2 rounded-full ml-2 shadow-[0_0_8px_currentColor]", isLow ? "bg-emerald-500" : "bg-red-500")} />
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center space-x-4 mb-4">
              <div className={cn("p-3 rounded-2xl shadow-sm", isLow ? "bg-emerald-500/10" : "bg-red-500/10")}>
                <span className="text-3xl filter drop-shadow-md">{isLow ? '☀️' : '⚠️'}</span>
              </div>
              <h3 className="text-xl font-bold text-sky-text-primary tracking-tight">
                {isLow ? "Clear Conditions" : "Severe Weather Alert"}
              </h3>
            </div>
            <p className="text-sm font-medium text-sky-text-secondary leading-relaxed max-w-[280px]">
              {isLow 
                ? "No severe weather expected today. Conditions are optimal for outdoor activities and travel."
                : (alerts?.[0]?.event || "Severe weather conditions are expected in your area. Please exercise caution.")}
            </p>
          </div>
          
          {/* Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-border to-transparent my-6 opacity-60" />
          
          <div className="space-y-5">
            {/* UV Index Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-sky-text-secondary font-semibold flex items-center gap-1.5">
                  <Sun className="h-4 w-4" /> UV Index
                </span>
                <span className="font-bold text-sky-text-primary">
                  {uvValue} <span className="text-sky-text-secondary font-medium ml-1">{getUILabel(uvValue)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-sky-surface-elevated rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-1000 ease-out", 
                    uvValue > 7 ? "bg-red-500" : uvValue > 4 ? "bg-orange-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${getUVProgress(uvValue)}%` }}
                />
              </div>
            </div>

            {/* Visibility Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-sky-text-secondary font-semibold flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> Visibility
                </span>
                <span className="font-bold text-sky-text-primary">
                  {visibilityVal !== undefined ? `${(visibilityVal > 1000 ? visibilityVal/1000 : visibilityVal).toFixed(0)} ${visibilityVal > 1000 ? 'km' : 'm'}` : '10 km'}
                </span>
              </div>
              <div className="h-1.5 w-full bg-sky-surface-elevated rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out bg-sky-primary"
                  style={{ width: `${Math.min(100, (visibilityVal / 10000) * 100)}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
