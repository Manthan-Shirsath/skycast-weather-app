import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './layout';

// Loading Skeleton for seamless lazy transitions
const PageLoadingFallback = () => (
  <div className="w-full h-full min-h-[70vh] flex flex-col items-center justify-center p-8 gap-4 animate-pulse">
    <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    <div className="text-sm font-medium text-text-secondary">Loading view...</div>
  </div>
);

// Route-level Code Splitting (Lazy Loading)
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const WeatherGPTPage = lazy(() => import('../features/weathergpt/WeatherGPTPage'));
const MapPage = lazy(() => import('../features/map/MapPage'));
const ClimatePage = lazy(() => import('../features/climate/ClimatePage'));
const AlertsPage = lazy(() => import('../features/alerts/AlertsPage'));
const AgriculturePage = lazy(() => import('../features/agriculture/AgriculturePage'));
const LocationsPage = lazy(() => import('../features/locations/LocationsPage'));
const ForecastIntelligencePage = lazy(() => import('../features/forecast-intelligence/ForecastIntelligencePage'));

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoadingFallback />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: withSuspense(DashboardPage),
      },
      {
        path: 'weathergpt',
        element: withSuspense(WeatherGPTPage),
      },
      {
        path: 'forecast',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'map',
        element: withSuspense(MapPage),
      },
      {
        path: 'maps',
        element: <Navigate to="/map" replace />,
      },
      {
        path: 'alerts',
        element: withSuspense(AlertsPage),
      },
      {
        path: 'climate',
        element: withSuspense(ClimatePage),
      },
      {
        path: 'agriculture',
        element: withSuspense(AgriculturePage),
      },
      {
        path: 'locations',
        element: withSuspense(LocationsPage),
      },
      {
        path: 'forecast-intelligence',
        element: withSuspense(ForecastIntelligencePage),
      },
    ],
  },
]);
