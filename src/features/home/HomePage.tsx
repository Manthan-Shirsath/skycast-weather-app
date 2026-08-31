import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDashboard } from '@/lib/query/hooks';
import { Button } from '@/components/ui/Button';
import { MapPin } from 'lucide-react';
import { WeatherHero } from './WeatherHero';
import { HourlyForecast } from './HourlyForecast';
import { CurrentRisk } from './CurrentRisk';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const city = searchParams.get('city') || 'Pune';
  
  const { data: dashboard, isLoading, isError } = useDashboard(city);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-sky-surface border border-sky-border rounded-xl shadow-sm">
          <p className="text-sky-danger text-lg font-semibold">Weather data unavailable</p>
          <p className="text-sky-text-secondary text-sm max-w-sm">
            We couldn't retrieve the latest data for {city}. Please check your connection or try again.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
        </div>
      </div>
    );
  }

  const { location, current, hourly, alerts, sun } = dashboard || {};

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      {/* Top Search / Location Bar (Mobile only, Desktop is in AppLayout) */}
      <div className="lg:hidden sticky top-0 z-50 bg-sky-background/80 backdrop-blur-md border-b border-sky-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sky-text-primary font-medium">
          <MapPin className="h-4 w-4 text-sky-primary" />
          <span className="text-sm">{location?.displayLocation || city}</span>
        </div>
      </div>

      <div className="flex-1 max-w-[1400px] mx-auto w-full p-4 lg:p-8 space-y-8 pb-24">
        
        {/* 1. Hero / Current Weather */}
        <WeatherHero 
          isLoading={isLoading} 
          location={location} 
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
      </div>
    </div>
  );
}
