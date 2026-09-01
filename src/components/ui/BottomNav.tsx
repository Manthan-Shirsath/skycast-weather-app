import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Sparkles, TrendingUp, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  
  const NAV_ITEMS = [
    { name: t('nav.home', 'Home'), path: '/', icon: Home },
    { name: t('nav.weathergpt', 'WeatherGPT'), path: '/weathergpt', icon: Sparkles },
    { name: t('nav.forecast', 'Forecast'), path: '/forecast', icon: TrendingUp },
    { name: t('nav.weather_map', 'Map'), path: '/map', icon: MapIcon },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-sky-surface/90 backdrop-blur-xl border-t border-sky-border pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-colors duration-200",
                isActive ? "text-sky-primary" : "text-sky-text-secondary hover:text-sky-text-primary hover:bg-sky-surface-elevated/40"
              )}
            >
              <div className="relative mb-1">
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-primary"></span>
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-wide transition-all",
                isActive ? "opacity-100" : "opacity-80"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
