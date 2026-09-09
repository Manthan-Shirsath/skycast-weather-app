import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './layout';

// Lazy loading features
import DashboardPage from '../features/dashboard/DashboardPage';
import WeatherGPTPage from '../features/weathergpt/WeatherGPTPage';
import MapPage from '../features/map/MapPage';
import ClimatePage from '../features/climate/ClimatePage';
import AlertsPage from '../features/alerts/AlertsPage';
import AgriculturePage from '../features/agriculture/AgriculturePage';
import LocationsPage from '../features/locations/LocationsPage';
import ForecastIntelligencePage from '../features/forecast-intelligence/ForecastIntelligencePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'weathergpt',
        element: <WeatherGPTPage />,
      },
      {
        path: 'forecast',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'map',
        element: <MapPage />,
      },
      {
        path: 'maps',
        element: <Navigate to="/map" replace />,
      },
      {
        path: 'alerts',
        element: <AlertsPage />,
      },
      {
        path: 'climate',
        element: <ClimatePage />,
      },
      {
        path: 'agriculture',
        element: <AgriculturePage />,
      },
      {
        path: 'locations',
        element: <LocationsPage />,
      },
      {
        path: 'forecast-intelligence',
        element: <ForecastIntelligencePage />,
      },
    ],
  },
]);
