import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Sparkles, MapPin, Droplets, Wind, Thermometer, Navigation } from 'lucide-react';
import { getTimeOfDay } from '@/lib/weather-visuals';
import { WeatherBackground } from './WeatherBackground';
import { cn } from '@/lib/utils';

interface WeatherHeroProps {
  isLoading: boolean;
  location: any;
  current: any;
  sun: any;
  hourly: any[];
  onOpenWeatherGPT: () => void;
}

export function WeatherHero({ isLoading, location, current, sun, hourly, onOpenWeatherGPT }: WeatherHeroProps) {
  // Determine date and time to display
  const currentDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(new Date());
  }, []);

  const localTime = useMemo(() => {
    if (hourly && hourly.length > 0 && hourly[0].time) {
      const d = new Date(hourly[0].time);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(d);
      }
    }
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  }, [hourly]);

  // Determine time of day for dynamic background
  const timeOfDay = useMemo(() => {
    const localHour = hourly && hourly.length > 0 ? hourly[0].hour : undefined;
    return getTimeOfDay(localHour, sun?.sunrise, sun?.sunset);
  }, [hourly, sun]);

  if (isLoading) {
    return <Skeleton className="w-full h-[520px] rounded-[2rem]" />;
  }

  return (
    <section className="relative w-full h-[520px] rounded-[2.5rem] overflow-hidden shadow-[var(--shadow-lg)] border-0 isolate group transition-all duration-700">
      {/* Dynamic Animated CSS Background */}
      <WeatherBackground condition={current?.condition} timeOfDay={timeOfDay} />
      
      {/* Premium Gradients for Depth */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 mix-blend-multiply transition-opacity duration-1000" />
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/60 via-transparent to-black/30 opacity-70" />
      
      {/* Inner Glow / Border */}
      <div className="absolute inset-0 z-0 rounded-[2.5rem] border border-white/10 pointer-events-none" />
      
      <div className="relative z-10 p-8 md:p-14 h-full flex flex-col justify-between">
        
        {/* Top: Location & Date */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center space-x-2 bg-black/20 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full w-max shadow-sm">
            <Navigation className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold tracking-wide text-white">
              {location?.displayLocation || location?.city || 'Unknown Location'}
            </span>
          </div>
          <p className="text-white/70 font-medium tracking-wide drop-shadow-md text-sm ml-2">
            {currentDate} &bull; {localTime}
          </p>
        </div>

        {/* Bottom Area: Weather Stats & WeatherGPT */}
        <div className="flex flex-col lg:flex-row justify-between items-end gap-10">
          
          {/* Main Weather Information */}
          <div className="text-white w-full lg:w-auto flex flex-col drop-shadow-2xl">
            <div className="flex items-start">
              <h1 className="text-[9rem] md:text-[11rem] font-black tracking-tighter leading-none" style={{ textShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                {current?.tempC !== undefined ? Math.round(current.tempC) : '--'}
              </h1>
              <span className="text-5xl md:text-7xl font-bold mt-4 ml-1 text-white/80">°</span>
            </div>
            
            <div className="flex items-center space-x-4 mb-8 -mt-2">
               <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-lg">
                 <img 
                   src={`https://openweathermap.org/img/wn/${
                     {
                       'sun': '01d', 'clear': '01d', 'partly-cloudy': '02d', 
                       'cloudy': '03d', 'overcast': '04d', 'fog': '50d', 
                       'rain': '10d', 'snow': '13d', 'thunderstorm': '11d'
                     }[(current?.icon || '').toLowerCase()] || '02d'
                   }@2x.png`} 
                   alt={current?.condition} 
                   className="h-14 w-14 object-contain filter drop-shadow-lg scale-110"
                 />
               </div>
               <span className="text-4xl md:text-5xl font-bold tracking-tight text-glow">
                 {current?.condition || '--'}
               </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
              <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 hover:bg-black/40 transition-all hover:-translate-y-1 shadow-lg">
                <Droplets className="h-4 w-4 text-blue-400" />
                <span className="text-white/90">{current?.humidity || 0}% Humidity</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 hover:bg-black/40 transition-all hover:-translate-y-1 shadow-lg">
                <Wind className="h-4 w-4 text-emerald-400" />
                <span className="text-white/90">{current?.windSpeedKmh ? Math.round(current.windSpeedKmh) : 0} km/h Wind</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 hover:bg-black/40 transition-all hover:-translate-y-1 shadow-lg">
                <Thermometer className="h-4 w-4 text-orange-400" />
                <span className="text-white/90">Feels like {current?.feelsLikeC ? Math.round(current.feelsLikeC) : '--'}°</span>
              </div>
            </div>
          </div>

          {/* WeatherGPT Insight Card - Premium AI Feel */}
          <div className="w-full lg:max-w-[420px] shrink-0 animate-float">
            <div className="relative group/card">
              {/* Animated glow behind the card */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-ai via-blue-500 to-sky-ai rounded-3xl blur opacity-30 group-hover/card:opacity-60 transition duration-1000 group-hover/card:duration-200 animate-pulse-slow"></div>
              
              <div className="relative bg-black/40 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl p-7 hover:bg-black/50 transition-colors flex flex-col">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="bg-gradient-to-br from-sky-ai to-blue-600 p-3 rounded-2xl shrink-0 shadow-glow">
                    <Sparkles className="h-6 w-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg tracking-tight mb-1">AI Weather Insight</h3>
                    <p className="text-sm font-medium leading-relaxed text-white/80 line-clamp-3">
                      Conditions are stable. Expect {current?.condition?.toLowerCase() || 'clear'} skies for the next few hours. Perfect time for outdoor activities.
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={onOpenWeatherGPT}
                  className="w-full justify-between font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl h-12 shadow-sm transition-all hover:scale-[1.02]"
                >
                  Open WeatherGPT <span className="ml-2 group-hover/card:translate-x-1 transition-transform">&rarr;</span>
                </Button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
