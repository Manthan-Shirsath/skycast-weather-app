import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils/styles';

interface WeatherSceneProps {
  conditionCode?: number; // e.g. from OpenWeather
  conditionText?: string;
  isDay?: boolean;
  className?: string;
}

function getSceneState(text: string = '', code: number = 0, isDay: boolean = true) {
  const t = text.toLowerCase();
  
  if (t.includes('rain') || t.includes('drizzle') || (code >= 500 && code < 600)) {
    return 'rain';
  }
  if (t.includes('thunder') || (code >= 200 && code < 300)) {
    return 'thunderstorm';
  }
  if (t.includes('snow') || (code >= 600 && code < 700)) {
    return 'snow';
  }
  if (t.includes('fog') || t.includes('mist') || t.includes('haze') || (code >= 700 && code < 800)) {
    return 'fog';
  }
  if (t.includes('cloud') || (code > 801 && code <= 804)) {
    return isDay ? 'cloudy_day' : 'cloudy_night';
  }
  
  // Default to clear or partly cloudy
  return isDay ? 'clear_day' : 'clear_night';
}

const sceneConfig = {
  clear_day: {
    bg: 'bg-gradient-to-b from-blue-400 to-blue-200',
    elements: ['sun']
  },
  clear_night: {
    bg: 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-800',
    elements: ['stars', 'moon']
  },
  cloudy_day: {
    bg: 'bg-gradient-to-b from-blue-300 to-slate-200',
    elements: ['clouds']
  },
  cloudy_night: {
    bg: 'bg-gradient-to-b from-slate-800 to-slate-700',
    elements: ['dark_clouds']
  },
  rain: {
    bg: 'bg-gradient-to-b from-slate-700 to-slate-500',
    elements: ['dark_clouds', 'rain']
  },
  thunderstorm: {
    bg: 'bg-gradient-to-b from-slate-900 to-slate-700',
    elements: ['dark_clouds', 'rain', 'lightning']
  },
  snow: {
    bg: 'bg-gradient-to-b from-slate-300 to-slate-100',
    elements: ['clouds', 'snow']
  },
  fog: {
    bg: 'bg-gradient-to-b from-slate-400 to-slate-200',
    elements: ['fog']
  }
};

export function WeatherScene({ conditionCode, conditionText, isDay = true, className }: WeatherSceneProps) {
  const sceneKey = useMemo(() => getSceneState(conditionText, conditionCode, isDay), [conditionText, conditionCode, isDay]);
  const config = sceneConfig[sceneKey as keyof typeof sceneConfig] || sceneConfig.clear_day;

  return (
    <div className={cn("relative w-full h-full overflow-hidden transition-colors duration-1000", config.bg, className)}>
      <AnimatePresence>
        {config.elements.includes('sun') && (
          <motion.div
            key="sun"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-10 right-10 w-32 h-32 rounded-full bg-yellow-200 blur-xl opacity-60"
          />
        )}
        
        {config.elements.includes('moon') && (
          <motion.div
            key="moon"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-12 right-12 w-16 h-16 rounded-full bg-slate-200 shadow-[0_0_40px_rgba(255,255,255,0.4)]"
          />
        )}

        {config.elements.includes('stars') && (
          <motion.div
            key="stars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 90px 40px, white, rgba(0,0,0,0))',
              backgroundSize: '100px 100px',
              opacity: 0.5
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Decorative glass overlay for content to sit on top of */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
