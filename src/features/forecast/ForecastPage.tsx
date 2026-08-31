import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, CloudRain, Wind, CalendarDays, Loader2, ThermometerSun, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';

export default function ForecastPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city') || 'Pune';
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather/dashboard?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch forecast data", err);
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
          <p className="text-sky-text-secondary font-medium">{t('forecast.loading', 'Loading extended forecast...')}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8 text-sky-danger" />
          <p className="text-sky-text-secondary font-medium">{t('forecast.failed', 'Failed to load forecast.')}</p>
        </div>
      </div>
    );
  }

  const daily = data.daily || [];
  const hourly = data.hourly || [];
  
  // Format hourly data for the chart (next 24 hours)
  const chartData = hourly.slice(0, 24).map((h: any) => {
     // Extract hour string, e.g. "2023-10-10T14:00" -> "14:00"
     const timeParts = h.time.split('T');
     const hourStr = timeParts.length > 1 ? timeParts[1].substring(0, 5) : h.time;
     return {
        time: hourStr,
        temp: h.tempC,
        rain: h.rainChance
     }
  });

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-sky-primary" />
          Extended Forecast
        </h1>
        <p className="text-sky-text-secondary mt-1">Detailed weather predictions for {city}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-sky-border bg-sky-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('forecast.temp_trend', '24-Hour Temperature Trend')}</CardTitle>
            <CardDescription>{t('forecast.expected_vars', 'Expected temperature variations')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="time" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                    dy={10}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tickFormatter={(val) => `${val}°`}
                  />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleString()}
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="temp" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rain Probability Chart */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('forecast.precip_forecast', 'Precipitation Forecast')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="time" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                    dy={10}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    domain={[0, 'auto']}
                    tickFormatter={(val) => `${val}mm`}
                  />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleString()}
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="rain" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Outlook */}
      <h2 className="text-xl font-bold text-sky-text-primary mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-sky-primary" />
        7-Day Outlook
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-12">
        {daily.slice(0, 7).map((day: any, i: number) => {
          const dateObj = new Date(day.date);
          const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          return (
            <Card key={i} className="border-sky-border bg-sky-surface shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-bold text-sky-text-primary">{dayName}</p>
                    <p className="text-xs text-sky-text-secondary">{dateString}</p>
                  </div>
                  {day.rainChance > 30 && (
                     <Badge variant="outline" className="bg-sky-accent/10 text-sky-accent border-sky-accent/20">
                       {day.rainChance}% Rain
                     </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 my-4">
                  <div className="bg-sky-background p-2 rounded-lg border border-sky-border">
                    <ThermometerSun className="h-6 w-6 text-sky-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-sky-text-primary">{day.highC}°</div>
                    <div className="text-sm font-medium text-sky-text-secondary">{day.lowC}°</div>
                  </div>
                </div>

                <p className="text-sm font-medium text-sky-text-primary mb-3">
                  {day.condition}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs text-sky-text-secondary border-t border-sky-border pt-3">
                   <div className="flex items-center gap-1">
                     <Wind className="h-3 w-3" />
                     {day.windSpeedKmh || '--'} km/h
                   </div>
                   <div className="flex items-center gap-1">
                     <CloudRain className="h-3 w-3" />
                     {day.rainChance || 0}%
                   </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
