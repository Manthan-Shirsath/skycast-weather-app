import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CloudRain, Loader2, AlertCircle, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';


type TrendRange = '24h' | '7d' | '30d';

export default function ClimatePage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const city = searchParams.get('city') || 'Pune';
  
  const [range, setRange] = useState<TrendRange>('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/trends?city=${encodeURIComponent(city)}&range=${range}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch climate trends", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [city, range]);

  const parsedChartData = React.useMemo(() => {
    if (!data || !data.observations) return [];
    return data.observations.map((d: any) => ({
      ...d,
      timeMs: new Date(d.timestamp).getTime()
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-sky-primary" />
          <p className="text-sky-text-secondary font-medium">{t('climate.analyzing', 'Analyzing historical data...')}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8 text-sky-danger" />
          <p className="text-sky-text-secondary font-medium">{t('climate.failed', 'Failed to load climate data.')}</p>
        </div>
      </div>
    );
  }

  const primaryCity = data.city;
  const chartData = data.observations || [];
  const avg_temp = data.temperature?.avg;
  const peak_temp = data.temperature?.max;
  const min_temp = data.temperature?.min;
  const avg_humidity = data.humidity?.avg;
  const total_rain = data.rainfall?.total;
  const comparison_data = data.comparison;

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-sky-primary" />
            {t('nav.climate', 'Climate Trends')}
          </h1>
          <p className="text-sky-text-secondary mt-1">Historical analytics for {primaryCity}</p>
        </div>
        
        <div className="flex bg-sky-surface-elevated rounded-lg p-1 border border-sky-border shadow-sm">
          {(['24h', '7d', '30d'] as TrendRange[]).map((r) => (
            <Button
              key={r}
              variant="ghost"
              size="sm"
              onClick={() => setRange(r)}
              className={`px-4 text-xs font-semibold ${
                range === r 
                  ? 'bg-sky-primary text-white shadow-sm hover:bg-sky-primary/90 hover:text-white' 
                  : 'text-sky-text-secondary hover:text-sky-text-primary'
              }`}
            >
              {r.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-4 md:p-5">
            <p className="text-xs font-semibold text-sky-text-secondary uppercase tracking-wider mb-2">Average Temp</p>
            <div className="flex items-end justify-between">
               <span className="text-2xl md:text-3xl font-black text-sky-text-primary">{avg_temp?.toFixed(1) || '--'}°</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-4 md:p-5">
            <p className="text-xs font-semibold text-sky-text-secondary uppercase tracking-wider mb-2">Peak Temp</p>
            <div className="flex items-end justify-between">
               <span className="text-2xl md:text-3xl font-black text-sky-text-primary flex items-center gap-1 text-red-500">
                  <TrendingUp className="h-5 w-5 mb-1" />
                  {peak_temp?.toFixed(1) || '--'}°
               </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-4 md:p-5">
            <p className="text-xs font-semibold text-sky-text-secondary uppercase tracking-wider mb-2">Low Temp</p>
            <div className="flex items-end justify-between">
               <span className="text-2xl md:text-3xl font-black text-sky-text-primary flex items-center gap-1 text-blue-500">
                  <TrendingDown className="h-5 w-5 mb-1" />
                  {min_temp?.toFixed(1) || '--'}°
               </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardContent className="p-4 md:p-5">
            <p className="text-xs font-semibold text-sky-text-secondary uppercase tracking-wider mb-2">Total Rain</p>
            <div className="flex items-end justify-between">
               <span className="text-2xl md:text-3xl font-black text-sky-text-primary">{total_rain?.toFixed(1) || '0'}mm</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 pb-12">
        {/* Main Temperature Trend Chart */}
        <Card className="border-sky-border bg-sky-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Temperature Analysis</CardTitle>
            <CardDescription>Historical temperature observations over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-text-secondary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={parsedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis 
                      dataKey="timeMs"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      scale="time"
                      tickCount={range === '24h' ? 6 : (range === '7d' ? 7 : 10)}
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                      dy={10}
                      minTickGap={30}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return range === '24h' 
                          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => `${val}°`}
                    />
                    <Tooltip 
                      labelFormatter={(val) => new Date(val).toLocaleString()}
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      name={primaryCity}
                      stroke="var(--accent)" 
                      strokeWidth={3} 
                      dot={range === '30d' ? false : { r: 3, fill: "var(--surface)", strokeWidth: 2 }} 
                      activeDot={{ r: 6 }} 
                    />
                    {comparison_data && (
                      <Line 
                        type="monotone" 
                        dataKey="compare_temp" 
                        name="Comparison City"
                        stroke="var(--accent-ai)" 
                        strokeWidth={3} 
                        dot={range === '30d' ? false : { r: 3, fill: "var(--surface)", strokeWidth: 2 }} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
