import React from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useDashboard } from '@/lib/query/hooks';
import { Button } from '@/components/ui/Button';
import { MapPin, CloudOff, TrendingUp, CalendarDays, ThermometerSun, Wind, CloudRain } from 'lucide-react';
import { WeatherHero } from './WeatherHero';
import { HourlyForecast } from './HourlyForecast';
import { CurrentRisk } from './CurrentRisk';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Badge } from '@/components/ui/Badge';

export default function DashboardPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const city = searchParams.get('city') || 'Pune';
  
  const { data: dashboard, isLoading, isError } = useDashboard(city);

  if (isError) {
    return (
      <div className="h-62.5 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 bg-sky-surface border border-sky-border rounded-xl shadow-sm">
          <CloudOff className="h-12 w-12 text-sky-text-secondary opacity-50" />
          <p className="text-sky-danger text-lg font-semibold">{t('home.unavailable', 'Weather data unavailable')}</p>
          <p className="text-sky-text-secondary text-sm max-w-sm text-center">
            {t('home.errorDescription', 'We couldn\'t retrieve the latest data for {{city}}. Please check your connection or try again.', { city })}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">{t('home.retry', 'Retry')}</Button>
        </div>
      </div>
    );
  }

  const { location: locationData, current, hourly = [], daily = [], alerts, sun } = dashboard || {};

  // Format hourly data for the chart (next 24 hours)
  const chartData = hourly.slice(0, 24).map((h: any) => {
     const timeParts = h.time.split('T');
     const hourStr = timeParts.length > 1 ? timeParts[1].substring(0, 5) : h.time;
     return {
        time: hourStr,
        temp: h.tempC,
        rain: h.rainChance
     }
  });

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      {/* Top Search / Location Bar (Mobile only, Desktop is in AppLayout) */}
      <div className="lg:hidden sticky top-0 z-50 bg-sky-background/80 backdrop-blur-md border-b border-sky-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sky-text-primary font-medium">
          <MapPin className="h-4 w-4 text-sky-primary" />
          <span className="text-sm">{locationData?.displayLocation || city}</span>
        </div>
      </div>

      <div className="w-full max-w-350 mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6 pb-24">
        
        {/* 1. Hero / Current Weather */}
        <WeatherHero 
          isLoading={isLoading} 
          location={locationData} 
          current={current} 
          sun={sun} 
          hourly={hourly} 
          onOpenWeatherGPT={() => navigate('/weathergpt')} 
        />

        {/* 2 & 3. Grid for Forecast and Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <HourlyForecast isLoading={isLoading} hourly={hourly} />
          </div>
          <div className="lg:col-span-1">
            <CurrentRisk isLoading={isLoading} current={current} alerts={alerts} />
          </div>
        </div>

        {/* 4. Forecast Charts */}
        {!isLoading && hourly.length > 0 && (
          <>
            <div className="mb-4 mt-12">
              <h2 className="text-2xl font-bold text-sky-text-primary flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-sky-primary" />
                {t('forecast.extended', 'Extended Forecast')}
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                          dy={10}
                          minTickGap={30}
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            if (isNaN(d.getTime())) return val;
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
                          labelFormatter={(val) => {
                            const d = new Date(val);
                            if (isNaN(d.getTime())) return val;
                            return d.toLocaleString();
                          }}
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
                          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                          dy={10}
                          minTickGap={30}
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            if (isNaN(d.getTime())) return val;
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
                          labelFormatter={(val) => {
                            const d = new Date(val);
                            if (isNaN(d.getTime())) return val;
                            return d.toLocaleString();
                          }}
                          contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="rain" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* 5. 7-Day Outlook */}
        {!isLoading && daily.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-sky-text-primary mb-4 mt-8 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-sky-primary" />
              {t('forecast.7_day_outlook', '7-Day Outlook')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-12">
              {daily.slice(0, 7).map((day: any, i: number) => {
                const dateObj = new Date(day.date);
                const dayName = i === 0 ? t('common.today', 'Today') : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
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
                           {day.windSpeedMax ?? '--'} km/h
                         </div>
                         <div className="flex items-center gap-1">
                           <CloudRain className="h-3 w-3" />
                           {day.rainChance ?? 0}%
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
