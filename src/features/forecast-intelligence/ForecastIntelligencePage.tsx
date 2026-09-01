import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Loader2, AlertCircle, Info, Clock, LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';


interface ForecastValue {
  valid_time: string;
  lead_hours: number;
  variable: string;
  representation?: string;
  value: number;
  unit: string;
}

interface IntelligenceModel {
  id: string;
  name: string;
  methodology?: string;
  forecast_type?: string;
  how_it_forecasts?: string;
  run_time?: string;
  fetched_at?: string;
  age_minutes?: number;
  status: 'fresh' | 'stale' | 'unavailable';
  forecast: ForecastValue[];
}

interface IntelligenceResponse {
  location: string;
  horizon_days: number;
  models: IntelligenceModel[];
  analytics?: Record<string, any>;
}

// Map known variables to readable names
const VARIABLE_LABELS: Record<string, string> = {
  'temperature_2m': 'Temperature',
  'temperature': 'Temperature',
  'precipitation': 'Precipitation Amount',
  'precipitation_probability': 'Precipitation Probability',
  'wind_speed_10m': 'Wind Speed',
  'wind_speed': 'Wind Speed',
};

// Colors for the charts
const MODEL_COLORS: Record<string, string> = {
  'ecmwf_ifs': 'var(--accent)',
  'ecmwf_aifs': 'var(--accent-ai)',
  'noaa_gfs': 'var(--warning)',
  'dwd_icon': 'var(--success)',
  'google_weathernext2': '#ec4899' // Pink for weathernext
};
const FALLBACK_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];

export default function ForecastIntelligencePage() {
  const [searchParams] = useSearchParams();
  const locationName = searchParams.get('city') || 'Pune';
  
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set());
  const [selectedVariable, setSelectedVariable] = useState<string>('');

  const fetchAiAnalysis = async (loc: string) => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await apiFetch(`/api/forecast-intelligence/${encodeURIComponent(loc)}/analysis`);
      if (res.ok) {
        const json = await res.json();
        setAiSummary(json.analysis);
      } else {
        setAiSummary("SkyCast analysis unavailable.");
      }
    } catch (err) {
      console.error(err);
      setAiSummary("SkyCast analysis unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch(`/api/forecast-intelligence/${encodeURIComponent(locationName)}`);
      if (!res.ok) throw new Error('API Error');
      const json: IntelligenceResponse = await res.json();
      setData(json);
      
      // Auto-enable available models
      const availableModels = json.models.filter(m => m.status !== 'unavailable').map(m => m.id);
      setEnabledModels(new Set(availableModels));
      
      // Trigger AI fetch independently without blocking
      fetchAiAnalysis(locationName);
      
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [locationName]);

  // Extract all available variables from the payload
  const availableVariables = useMemo(() => {
    if (!data) return [];
    const vars = new Set<string>();
    data.models.forEach(model => {
      model.forecast?.forEach(f => vars.add(f.variable));
    });
    return Array.from(vars);
  }, [data]);

  // Set default variable when data loads
  useEffect(() => {
    if (availableVariables.length > 0 && !selectedVariable) {
      if (availableVariables.includes('temperature_2m')) {
        setSelectedVariable('temperature_2m');
      } else if (availableVariables.includes('temperature')) {
        setSelectedVariable('temperature');
      } else {
        setSelectedVariable(availableVariables[0]);
      }
    }
  }, [availableVariables, selectedVariable]);

  // Group models by methodology
  const modelsByMethodology = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, IntelligenceModel[]> = {};
    data.models.forEach(m => {
      const method = m.methodology || 'unknown';
      if (!grouped[method]) grouped[method] = [];
      grouped[method].push(m);
    });
    return grouped;
  }, [data]);

  // Process data for the chart (Time aligned)
  const chartData = useMemo(() => {
    if (!data || !selectedVariable) return [];
    
    // Map: valid_time -> { timestamp: string, [model_id]: value, [`${model_id}_spread`]: value }
    const timeMap = new Map<string, any>();
    
    data.models.forEach(model => {
      if (!enabledModels.has(model.id)) return;
      
      model.forecast?.forEach(f => {
        if (f.variable !== selectedVariable) return;
        
        const vt = f.valid_time;
        if (!timeMap.has(vt)) {
          timeMap.set(vt, { timestamp: vt });
        }
        const entry = timeMap.get(vt);
        
        if (f.representation === 'ensemble_spread') {
          entry[`${model.id}_spread`] = f.value;
        } else {
          entry[model.id] = f.value; // deterministic or ensemble_mean
        }
      });
    });
    
    // Compute area ranges for probabilistic models
    Array.from(timeMap.values()).forEach(entry => {
      data.models.forEach(model => {
        if (entry[model.id] !== undefined && entry[`${model.id}_spread`] !== undefined) {
           // We use an array for Recharts Area
           entry[`${model.id}_range`] = [
             entry[model.id] - entry[`${model.id}_spread`],
             entry[model.id] + entry[`${model.id}_spread`]
           ];
        }
      });
    });
    
    const sorted = Array.from(timeMap.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sorted;
  }, [data, selectedVariable, enabledModels]);

  // Get Backend Analytics for selected variable
  const variableAnalytics = useMemo(() => {
    if (!data || !data.analytics || !selectedVariable) return null;
    return data.analytics[selectedVariable];
  }, [data, selectedVariable]);

  const toggleModel = (id: string) => {
    const newSet = new Set(enabledModels);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setEnabledModels(newSet);
  };

  const activeUnit = data?.models.flatMap(m => m.forecast).find(f => f.variable === selectedVariable)?.unit || '';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-sky-primary" />
          <p className="text-sky-text-secondary font-medium">Fetching Multi-Model Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-sky-danger" />
          <h2 className="text-xl font-bold text-sky-text-primary">Forecast Intelligence is temporarily unavailable.</h2>
          <p className="text-sky-text-secondary">We could not retrieve the multi-model data at this time.</p>
          <Button onClick={fetchData} variant="outline" className="mt-2 border-sky-border text-sky-text-primary">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (data.models.length === 0 || availableVariables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-sky-background p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Info className="h-10 w-10 text-sky-text-secondary" />
          <h2 className="text-xl font-bold text-sky-text-primary">No forecast intelligence data is currently available for this location.</h2>
          <p className="text-sky-text-secondary">The backend has not yet ingested multi-model forecasts for {locationName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="flex flex-col mb-8 gap-2">
        <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
          <LineChartIcon className="h-8 w-8 text-sky-primary" />
          Forecast Intelligence
        </h1>
        <p className="text-sky-text-secondary flex items-center gap-2 font-medium">
          {locationName} · {data.horizon_days}-day comparison
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pb-12">
        
        {/* Left Sidebar controls */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card className="border-sky-border bg-sky-surface shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wider text-sky-text-secondary">Analysis Variable</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {availableVariables.map(v => (
                <Button 
                  key={v}
                  variant={selectedVariable === v ? 'default' : 'outline'}
                  className={cn("justify-start", selectedVariable === v ? "bg-sky-primary text-white" : "border-sky-border text-sky-text-primary hover:bg-sky-surface-elevated")}
                  onClick={() => setSelectedVariable(v)}
                >
                  {VARIABLE_LABELS[v] || v}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-sky-border bg-sky-surface shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wider text-sky-text-secondary">Forecasting Models</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {Object.entries(modelsByMethodology).map(([methodology, models]) => (
                <div key={methodology} className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-text-secondary border-b border-sky-border pb-1 mb-1">
                    {methodology.replace('_', ' ')}
                  </h4>
                  <div className="flex flex-col gap-3">
                    {models.map((model, idx) => {
                      const color = MODEL_COLORS[model.id] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                      const isUnavailable = model.status === 'unavailable';
                      return (
                        <div key={model.id} className="flex items-center justify-between">
                          <label className={cn("flex items-center gap-3 text-sm font-medium", isUnavailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}>
                            <input 
                              type="checkbox" 
                              disabled={isUnavailable}
                              checked={enabledModels.has(model.id)}
                              onChange={() => toggleModel(model.id)}
                              className="rounded border-sky-border text-sky-primary focus:ring-sky-primary w-4 h-4"
                              style={{ accentColor: color }}
                            />
                            <span className="flex items-center gap-2 text-sky-text-primary">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isUnavailable ? 'gray' : color }}></span>
                              {model.name}
                            </span>
                          </label>
                          {isUnavailable && <span className="text-[10px] uppercase font-bold text-sky-danger bg-sky-danger/10 px-1.5 py-0.5 rounded">Unavailable</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {variableAnalytics && (
            <Card className="border-sky-border bg-sky-surface shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wider text-sky-text-secondary">Model Consensus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs text-sky-text-secondary uppercase tracking-wider font-bold block mb-1">Max Overall Disagreement</span>
                    <span className="text-lg font-bold text-sky-text-primary">
                      {variableAnalytics.overall_max_spread} {variableAnalytics.unit}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-xs text-sky-text-secondary uppercase tracking-wider font-bold block mb-2">Daily Agreement</span>
                    <div className="flex flex-wrap gap-2">
                      {variableAnalytics.periods?.map((p: any) => (
                        <div key={p.date} className="flex flex-col items-center bg-sky-surface-elevated/50 p-1.5 rounded border border-sky-border/50" title={`Max disagreement: ${p.max_spread}`}>
                          <span className="text-[10px] text-sky-text-secondary font-medium">{new Date(p.date).toLocaleDateString([], { weekday: 'short' })}</span>
                          <span className={cn(
                            "w-3 h-3 rounded-full mt-1",
                            p.agreement === 'high' ? 'bg-sky-success' : p.agreement === 'moderate' ? 'bg-sky-warning' : 'bg-sky-danger'
                          )}></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          
          {/* SkyCast AI Analysis */}
          <Card className="border-sky-border bg-sky-surface shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-accent-ai"></div>
             <CardContent className="p-4 md:p-6 pl-6 md:pl-8 flex flex-col gap-3">
               <div className="flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-accent-ai" />
                 <h3 className="font-bold text-sky-text-primary text-lg">SkyCast AI Analysis</h3>
               </div>
               
               {aiLoading ? (
                 <div className="flex items-center gap-3 py-2 text-sky-text-secondary">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   <span className="text-sm font-medium">Analyzing model agreement...</span>
                 </div>
               ) : (
                 <p className="text-sm text-sky-text-primary leading-relaxed">
                   {aiSummary || "Analysis not available."}
                 </p>
               )}
             </CardContent>
          </Card>

          {/* Main Chart */}
          <Card className="border-sky-border bg-sky-surface shadow-sm overflow-hidden">
             <CardHeader className="border-b border-sky-border/50 bg-sky-surface-elevated/30">
               <div className="flex justify-between items-center">
                 <div>
                   <CardTitle className="text-lg">{VARIABLE_LABELS[selectedVariable] || selectedVariable}</CardTitle>
                   <CardDescription>Multi-model comparison over {data.horizon_days} days</CardDescription>
                 </div>
               </div>
             </CardHeader>
             <CardContent className="p-4 md:p-6">
               <div className="h-[400px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                     <XAxis 
                       dataKey="timestamp" 
                       tickLine={false} 
                       axisLine={false} 
                       tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                       dy={10}
                       minTickGap={40}
                       tickFormatter={(val) => {
                         const d = new Date(val);
                         return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
                       }}
                     />
                     <YAxis 
                       tickLine={false} 
                       axisLine={false} 
                       tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                       domain={['auto', 'auto']}
                       tickFormatter={(val) => `${val}${activeUnit}`}
                     />
                     <Tooltip 
                       labelFormatter={(val) => new Date(val).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                       itemStyle={{ color: 'var(--text-primary)' }}
                     />
                     <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                     
                     {data.models.map((model, idx) => {
                       if (!enabledModels.has(model.id)) return null;
                       const color = MODEL_COLORS[model.id] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                       
                       const elements = [];
                       
                       // If probabilistic, add Area for spread
                       if (model.forecast_type === 'probabilistic') {
                          elements.push(
                            <Area 
                               key={`${model.id}-area`}
                               type="monotone"
                               dataKey={`${model.id}_range`}
                               stroke="none"
                               fill={color}
                               fillOpacity={0.15}
                               name={`${model.name} Spread`}
                               connectNulls
                            />
                          );
                       }
                       
                       elements.push(
                         <Line 
                           key={`${model.id}-line`}
                           type="monotone" 
                           dataKey={model.id} 
                           name={model.name}
                           stroke={color} 
                           strokeWidth={2.5} 
                           dot={false}
                           activeDot={{ r: 5 }}
                           connectNulls
                         />
                       );
                       
                       return elements;
                     })}
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
             </CardContent>
          </Card>

          {/* Model Information & Freshness Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.models.map(model => (
              <Card key={model.id} className={cn("border-sky-border shadow-sm", model.status === 'unavailable' ? "bg-sky-surface-elevated/30 opacity-70" : "bg-sky-surface")}>
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-sky-text-primary">{model.name}</h3>
                      <div className="mt-1 flex gap-2">
                        {model.methodology && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-sky-text-primary bg-sky-surface-elevated px-1.5 py-0.5 rounded">
                            {model.methodology.replace('_', ' ')}
                          </span>
                        )}
                        {model.forecast_type && (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-sky-text-primary bg-sky-surface-elevated px-1.5 py-0.5 rounded">
                            {model.forecast_type}
                          </span>
                        )}
                      </div>
                    </div>
                    {model.status === 'unavailable' ? (
                       <span className="text-[10px] uppercase font-bold text-sky-danger bg-sky-danger/10 px-2 py-1 rounded">Unavailable</span>
                    ) : (
                       <div className="flex flex-col items-end">
                         <span className={cn(
                           "text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1",
                           model.status === 'stale' ? "text-sky-warning bg-sky-warning/10" : "text-sky-success bg-sky-success/10"
                         )}>
                           <Clock className="w-3 h-3" />
                           {model.status === 'stale' ? 'Stale' : 'Fresh'}
                         </span>
                       </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-sky-text-secondary leading-relaxed mt-2">
                    {model.how_it_forecasts || "Description not available."}
                  </p>
                  
                  {model.status !== 'unavailable' && (
                    <div className="mt-2 flex flex-col gap-1 text-[11px] text-sky-text-secondary border-t border-sky-border pt-3">
                      <div className="flex justify-between">
                        <span>Run Time:</span>
                        <span className="font-medium text-sky-text-primary">{model.run_time ? new Date(model.run_time).toLocaleString() : '--'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Data Age:</span>
                        <span className="font-medium text-sky-text-primary">{model.age_minutes !== undefined ? `${model.age_minutes} min ago` : '--'}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

