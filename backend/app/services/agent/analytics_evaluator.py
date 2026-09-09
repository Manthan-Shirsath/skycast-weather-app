import logging
import statistics
from typing import Dict, Any, List

logger = logging.getLogger("skycast.agent.analytics_evaluator")

class AnalyticsEvaluator:
    @staticmethod
    def calculate_trends(hourly_slots: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates trends (rising, falling, stable) and stability/uncertainty 
        metrics for a given time window (e.g. today's remaining hourly slots).
        """
        if not hourly_slots or len(hourly_slots) < 2:
            return {
                "temperature_trend": "stable",
                "rain_trend": "stable",
                "wind_trend": "stable",
                "forecast_stability": "stable",
                "stability_reason": "Not enough data to calculate variance",
                "peak_rain_prob": 0,
                "peak_temp": None,
                "best_dry_window": None
            }
            
        # Parse data series
        temps = []
        rains = []
        winds = []
        
        for s in hourly_slots:
            temp = s.get("temperature_c", s.get("tempC"))
            if temp is not None: temps.append(float(temp))
            
            rain = s.get("precipitation_probability", s.get("rainChance", s.get("rain_probability_pct")))
            if rain is not None: rains.append(float(rain))
            
            wind = s.get("wind_speed_kmh", s.get("windSpeed", s.get("wind_speed_10m")))
            if wind is not None: winds.append(float(wind))
            
        # 1. Trends (First half vs Second half)
        def _get_trend(series: List[float], threshold: float = 2.0) -> str:
            if len(series) < 2: return "stable"
            mid = len(series) // 2
            first_half_avg = sum(series[:mid]) / len(series[:mid])
            second_half_avg = sum(series[mid:]) / len(series[mid:])
            diff = second_half_avg - first_half_avg
            if diff > threshold:
                return "rising" if threshold > 0 else "increasing"
            elif diff < -threshold:
                return "falling" if threshold > 0 else "decreasing"
            return "stable"

        temp_trend = _get_trend(temps, 2.0)
        rain_trend = _get_trend(rains, 15.0)
        wind_trend = _get_trend(winds, 5.0)
        
        # Override rain trend to "increasing" for UI if it's "rising" or "falling"
        if rain_trend == "rising": rain_trend = "increasing"
        if rain_trend == "falling": rain_trend = "decreasing"

        # 2. Peaks
        peak_rain = max(rains) if rains else 0
        peak_temp = max(temps) if temps else None
        
        # Best Dry Window (Longest consecutive 0% rain)
        best_dry_window = None
        current_streak = 0
        max_streak = 0
        best_start = None
        current_start = None
        
        for idx, r in enumerate(rains):
            if r <= 10:
                if current_streak == 0:
                    current_start = hourly_slots[idx].get("time")
                current_streak += 1
                if current_streak > max_streak:
                    max_streak = current_streak
                    best_start = current_start
            else:
                current_streak = 0
                
        if max_streak >= 2 and best_start:
            best_dry_window = f"Starts around {best_start}"
            
        # 3. Forecast Stability (Variance)
        # If rain probability has high variance (swings > 30%), timing is uncertain
        stability = "stable"
        stability_reason = "Forecast is relatively stable"
        
        if len(rains) >= 2:
            rain_stddev = statistics.stdev(rains)
            if rain_stddev > 30:
                stability = "uncertain"
                stability_reason = "Rain timing is uncertain"
            elif rain_stddev > 15:
                stability = "moderate"
                stability_reason = "Conditions are variable"
                
        if len(temps) >= 2 and stability == "stable":
            temp_stddev = statistics.stdev(temps)
            if temp_stddev > 5:
                stability = "moderate"
                stability_reason = "Temperature swings are likely"
                
        return {
            "temperature_trend": temp_trend,
            "rain_trend": rain_trend,
            "wind_trend": wind_trend,
            "forecast_stability": stability,
            "stability_reason": stability_reason,
            "peak_rain_prob": peak_rain,
            "peak_temp": peak_temp,
            "best_dry_window": best_dry_window
        }
