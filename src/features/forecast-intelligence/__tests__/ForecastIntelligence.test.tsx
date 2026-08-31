import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ForecastIntelligencePage from '../ForecastIntelligencePage';

// Mock ResizeObserver for Recharts
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

const mockData = {
  location: 'Pune',
  horizon_days: 7,
  models: [
    {
      id: 'ecmwf_ifs025',
      name: 'ECMWF IFS',
      category: 'PHYSICS-BASED NWP',
      description: 'Test description 1',
      run_time: '2026-08-31T00:00:00',
      fetched_at: '2026-08-31T12:00:00',
      age_minutes: 30,
      status: 'fresh',
      forecast: [
        { valid_time: '2026-08-31T12:00:00', lead_hours: 0, variable: 'temperature_2m', value: 25.5, unit: '°C' },
        { valid_time: '2026-08-31T12:00:00', lead_hours: 0, variable: 'precipitation', value: 0.0, unit: 'mm' }
      ]
    },
    {
      id: 'icon_seamless',
      name: 'DWD ICON',
      category: 'PHYSICS-BASED NWP',
      description: 'Test description 2',
      status: 'unavailable',
      forecast: []
    }
  ]
};

describe('ForecastIntelligencePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ForecastIntelligencePage />
      </BrowserRouter>
    );
  };

  it('renders loading state initially', () => {
    // Keep fetch pending
    global.fetch = vi.fn(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByText(/Fetching Multi-Model Data/i)).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/Forecast Intelligence is temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it('renders success state with models and variables', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ECMWF IFS')).toBeInTheDocument();
    });

    // Check variables are extracted
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Precipitation Amount')).toBeInTheDocument();

    // Check Unavailable state renders
    expect(screen.getByText('DWD ICON')).toBeInTheDocument();
    // Unavailable label is rendered next to the checkbox
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  });

  it('handles empty state', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ location: 'Pune', horizon_days: 7, models: [] })
    } as Response));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/No forecast intelligence data is currently available/i)).toBeInTheDocument();
    });
  });
});
