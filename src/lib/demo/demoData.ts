export function getDemoAlerts(city: string) {
  return [
    {
      id: `demo-alert-${city.toLowerCase()}-1`,
      severity: "warning",
      title: `Heavy Rainfall Advisory - ${city}`,
      region: city,
      description: `Heavy rainfall is possible during the forecast period in and around ${city}. Please exercise caution while driving.`,
      source: "Demo IMD Fallback",
      effective: new Date().toISOString(),
      expires: new Date(Date.now() + 86400000).toISOString(), // +24 hours
    }
  ];
}

export function getDemoTrends(city: string, range: string) {
  const dataPoints = range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const observations = [];
  const now = Date.now();
  
  const stepMs = range === '24h' ? 3600000 : 86400000;
  
  for (let i = dataPoints; i >= 0; i--) {
    const timestamp = new Date(now - i * stepMs).toISOString();
    
    // Deterministic pseudo-random based on index and city length
    const offset = Math.sin(i + city.length) * 5;
    
    observations.push({
      timestamp,
      temperature: 25 + offset,
      humidity: 60 + offset * 2,
      precipitation: i % 3 === 0 ? Math.abs(offset) : 0,
    });
  }

  return {
    city,
    range,
    observations,
    summary: {
      avg_temp: 25,
      max_temp: 30,
      min_temp: 20,
      total_precip: 15,
    }
  };
}

export function getDemoForecastIntelligence(city: string) {
  const models = ['IMD-GFS', 'ECMWF', 'GFS'];
  const forecast = [];
  
  for (let lead = 0; lead <= 72; lead += 6) {
    const validTime = new Date(Date.now() + lead * 3600000).toISOString();
    const tempOffset = Math.sin(lead / 12 * Math.PI) * 10;
    
    forecast.push({
      valid_time: validTime,
      lead_hours: lead,
      variable: 'temperature_2m',
      value: 25 + tempOffset,
      unit: '°C'
    });
  }

  return {
    location: city,
    horizon_days: 3,
    models: models.map(m => ({
      id: m.toLowerCase().replace('-', ''),
      name: m,
      status: 'fresh',
      forecast: forecast.map(f => ({
        ...f,
        value: f.value + (m === 'ECMWF' ? -0.5 : m === 'GFS' ? 0.5 : 0) // Slight variance for demo
      }))
    })),
    analytics: {
      verdict: `Demo Analysis for ${city}: Models are in general agreement. Expect normal diurnal temperature variations over the next 3 days.`,
      confidence: "High",
      trend: "Stable"
    }
  };
}
