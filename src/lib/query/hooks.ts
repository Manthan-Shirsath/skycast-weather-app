import { useQuery, useMutation } from '@tanstack/react-query';
import { weatherApi } from '../api/client';

export function useDashboard(city: string) {
  return useQuery({
    queryKey: ['weather', 'dashboard', city],
    queryFn: () => weatherApi.getDashboard(city),
    enabled: !!city,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentWeather(city: string) {
  return useQuery({
    queryKey: ['weather', 'current', city],
    queryFn: () => weatherApi.getCurrent(city),
    enabled: !!city,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useHourlyForecast(city: string) {
  return useQuery({
    queryKey: ['weather', 'hourly', city],
    queryFn: () => weatherApi.getHourly(city),
    enabled: !!city,
    staleTime: 15 * 60 * 1000,
  });
}

export function useDailyForecast(city: string) {
  return useQuery({
    queryKey: ['weather', 'daily', city],
    queryFn: () => weatherApi.getDaily(city),
    enabled: !!city,
    staleTime: 15 * 60 * 1000,
  });
}

export function useAlerts(city: string) {
  return useQuery({
    queryKey: ['weather', 'alerts', city],
    queryFn: () => weatherApi.getAlerts(city),
    enabled: !!city,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAirQuality(city: string) {
  return useQuery({
    queryKey: ['weather', 'air-quality', city],
    queryFn: () => weatherApi.getAirQuality(city),
    enabled: !!city,
    staleTime: 15 * 60 * 1000,
  });
}

export function useWeatherGPT() {
  return useMutation({
    mutationFn: ({ message, city, history }: { message: string, city: string, history?: any[] }) => 
      weatherApi.chat(message, city, history),
  });
}
