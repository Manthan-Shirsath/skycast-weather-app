import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Loader2, CheckCircle2, Info, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';

export default function AlertsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city') || 'Pune';
  
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather/alerts?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const json = await res.json();
          setAlerts(json);
        }
      } catch (err) {
        console.error("Failed to fetch alerts", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [city]);

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-sky-danger" />
          {t('alerts.title', 'Active Alerts')}
        </h1>
        <p className="text-sky-text-secondary mt-1">{t('alerts.subtitle', 'Weather warnings and advisories for {{city}}', { city })}</p>
      </div>

      <div className="max-w-4xl">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-sky-background">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-sky-primary" />
              <p className="text-sky-text-secondary font-medium">{t('alerts.checking', 'Checking for active weather alerts...')}</p>
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-sky-text-primary mb-2">{t('alerts.no_alerts', 'No Active Alerts')}</h2>
              <p className="text-sky-text-secondary max-w-md">
                {t('alerts.no_alerts_desc', 'There are currently no active weather alerts or warnings for {{city}}.', { city })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert: any, i: number) => {
              const isWarning = alert.severity === 'Warning' || alert.severity === 'Severe';
              const isWatch = alert.severity === 'Watch' || alert.severity === 'Moderate';
              
              return (
                <Card 
                  key={i} 
                  className={cn(
                    "border-l-4 shadow-sm",
                    isWarning ? "border-l-sky-danger bg-sky-danger/5" : 
                    isWatch ? "border-l-sky-warning bg-sky-warning/5" : 
                    "border-l-sky-primary bg-sky-primary/5"
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2 text-sky-text-primary">
                        {isWarning ? <AlertTriangle className="h-5 w-5 text-sky-danger" /> : 
                         isWatch ? <Bell className="h-5 w-5 text-sky-warning" /> : 
                         <Info className="h-5 w-5 text-sky-primary" />}
                        {alert.event || alert.title || t('alerts.default_title', 'Weather Advisory')}
                      </CardTitle>
                      <Badge variant={isWarning ? 'destructive' : isWatch ? 'secondary' : 'default'} className="uppercase text-[10px]">
                        {alert.severity || t('alerts.advisory', 'Advisory')}
                      </Badge>
                    </div>
                    <CardDescription className="text-sky-text-secondary font-medium mt-1">
                      {t('alerts.issued_at', 'Issued at')}: {alert.effective ? new Date(alert.effective).toLocaleString() : t('alerts.recently', 'Recently')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sky-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                      {alert.description || alert.headline || t('alerts.no_description', 'No detailed description available.')}
                    </p>
                    {alert.instruction && (
                      <div className="mt-4 pt-4 border-t border-sky-border/50">
                        <p className="text-sm font-semibold mb-1 opacity-80">{t('alerts.recommended_action', 'Recommended Action')}</p>
                        <p className="text-sm">
                          {alert.instruction || t('alerts.default_instruction', 'Please monitor local news stations and take necessary precautions for this weather event.')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
