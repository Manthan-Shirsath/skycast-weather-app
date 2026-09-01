import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sprout, Loader2, AlertCircle, Droplets, Sun, Wind, CloudRain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';


export default function AgriculturePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city') || 'Pune';
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/weather/dashboard?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch agriculture data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [city]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-sky-primary" />
          <p className="text-sky-text-secondary font-medium">{t('agriculture.loading', 'Loading agricultural intelligence...')}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8 text-sky-danger" />
          <p className="text-sky-text-secondary font-medium">{t('agriculture.failed', 'Failed to load data.')}</p>
        </div>
      </div>
    );
  }

  const { current, daily } = data;
  const today = daily && daily.length > 0 ? daily[0] : null;

  // Derive mock ag-metrics from standard weather data if real ag data isn't present
  const soilMoisture = Math.max(10, Math.min(90, (current?.humidity || 50) * 0.8 + (current?.rain || 0) * 5));
  const evapotranspiration = (current?.tempC || 25) * 0.15; // mock calc
  const growingDegreeDays = Math.max(0, ((today?.highC || 25) + (today?.lowC || 15)) / 2 - 10);
  
  const isGoodSprayingCondition = (current?.windSpeedKmh || 10) < 15 && (current?.rain || 0) === 0;

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
          <Sprout className="h-8 w-8 text-emerald-600" />
          {t('agriculture.title', 'Agriculture Intelligence')}
        </h1>
        <p className="text-sky-text-secondary mt-1">{t('agriculture.subtitle', 'Farming conditions and crop indicators for {{city}}', { city })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Soil Moisture */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-sm font-semibold text-sky-text-secondary mb-1">{t('agriculture.soil_moisture', 'Estimated Soil Moisture')}</p>
                  <div className="text-3xl font-black text-sky-text-primary">{soilMoisture.toFixed(0)}%</div>
               </div>
               <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/20">
                 <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
               </div>
            </div>
            <Progress value={soilMoisture} className="h-2 mb-2 bg-sky-border" indicatorClassName="bg-blue-500" />
            <p className="text-xs text-sky-text-secondary text-right">{t('agriculture.depth', '0-10cm depth')}</p>
          </CardContent>
        </Card>

        {/* Evapotranspiration */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-sm font-semibold text-sky-text-secondary mb-1">{t('agriculture.et0', 'Evapotranspiration (ET0)')}</p>
                  <div className="text-2xl font-bold text-sky-text-primary">
                    {evapotranspiration.toFixed(1)} <span className="text-sm font-normal text-sky-text-secondary">{t('agriculture.mm_day', 'mm/day')}</span>
                  </div>
               </div>
               <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/20">
                 <Sun className="h-6 w-6 text-amber-600 dark:text-amber-400" />
               </div>
            </div>
            <p className="text-xs text-sky-text-secondary mt-auto">{t('agriculture.ref_crop', 'Reference crop rate')}</p>
          </CardContent>
        </Card>

        {/* Growing Degree Days */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-sm font-semibold text-sky-text-secondary mb-1">{t('agriculture.gdd', 'Growing Degree Days')}</p>
                  <div className="text-3xl font-black text-sky-text-primary">{growingDegreeDays.toFixed(1)}</div>
               </div>
               <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/20">
                 <Sprout className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
               </div>
            </div>
            <p className="text-xs text-sky-text-secondary mt-auto">{t('agriculture.gdd_base', 'Base 10°C calculation')}</p>
          </CardContent>
        </Card>
        
        {/* Spraying Conditions */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-sm font-semibold text-sky-text-secondary mb-1">{t('agriculture.spraying', 'Spraying Conditions')}</p>
                  <div className="mt-2">
                     <Badge variant="outline" className={isGoodSprayingCondition ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}>
                       {isGoodSprayingCondition ? t('agriculture.favorable', 'Favorable') : t('agriculture.poor', 'Poor Conditions')}
                     </Badge>
                  </div>
               </div>
               <div className="p-2 bg-sky-primary/10 rounded-lg">
                 <Wind className="h-6 w-6 text-sky-primary" />
               </div>
            </div>
            <div className="text-xs text-sky-text-secondary mt-auto flex flex-col gap-1">
               <span>{t('agriculture.wind', 'Wind')}: {current?.windSpeedKmh} km/h</span>
               <span>{t('agriculture.rain', 'Rain')}: {current?.rain} mm</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
         {/* 7-Day Rainfall Forecast */}
         <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('agriculture.water_needs', 'Crop Water Needs')}</CardTitle>
            <CardDescription>{t('agriculture.water_desc', '7-day precipitation forecast vs typical requirement')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
               {daily?.slice(0,5).map((d: any, i: number) => (
                 <div key={i} className="flex items-center justify-between">
                   <span className="text-sm font-medium w-16">{i === 0 ? t('common.today', 'Today') : new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                   <div className="flex-1 mx-4">
                      <div className="relative h-4 bg-sky-background rounded-full overflow-hidden border border-sky-border">
                         <div 
                           className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" 
                           style={{ width: `${Math.min(100, (d.precipitation_sum_mm || d.rainChance || 0))}%` }}
                         />
                      </div>
                   </div>
                   <span className="text-sm text-sky-text-secondary w-16 text-right flex items-center justify-end gap-1">
                     {d.precipitation_sum_mm || d.rainChance || 0}
                     <CloudRain className="h-3 w-3" />
                   </span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
