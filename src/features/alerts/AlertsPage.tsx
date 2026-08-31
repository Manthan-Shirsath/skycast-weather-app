import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Info, Bell, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export default function AlertsPage() {
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
          Active Alerts
        </h1>
        <p className="text-sky-text-secondary mt-1">Weather warnings and advisories for {city}</p>
      </div>

      <div className="max-w-4xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-sky-surface rounded-2xl border border-sky-border shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-sky-primary mb-4" />
            <p className="text-sky-text-secondary font-medium">Checking for active weather alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-sky-surface rounded-2xl border border-sky-border shadow-sm text-center">
            <div className="bg-sky-success/10 p-4 rounded-full mb-4">
              <ShieldAlert className="h-8 w-8 text-sky-success" />
            </div>
            <h2 className="text-xl font-bold text-sky-text-primary mb-2">No Active Alerts</h2>
            <p className="text-sky-text-secondary max-w-md">
              There are currently no severe weather warnings or advisories issued for {city}. Conditions are generally safe.
            </p>
          </div>
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
                        {alert.event || alert.title || 'Weather Advisory'}
                      </CardTitle>
                      <Badge variant={isWarning ? 'destructive' : isWatch ? 'secondary' : 'default'} className="uppercase text-[10px]">
                        {alert.severity || 'Advisory'}
                      </Badge>
                    </div>
                    <CardDescription className="text-sky-text-secondary font-medium mt-1">
                      Issued at: {alert.effective ? new Date(alert.effective).toLocaleString() : 'Recently'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sky-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                      {alert.description || alert.headline || 'No detailed description available.'}
                    </p>
                    {alert.instruction && (
                      <div className="mt-4 p-3 bg-sky-surface-elevated rounded-lg border border-sky-border">
                        <p className="text-xs font-bold text-sky-text-primary uppercase tracking-wider mb-1">Recommended Action</p>
                        <p className="text-sm text-sky-text-secondary">{alert.instruction}</p>
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
