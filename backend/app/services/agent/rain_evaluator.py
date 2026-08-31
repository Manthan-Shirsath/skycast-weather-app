"""
Deterministic Rain Evaluator
Analyzes hourly weather series to compute rain statistics, identify dry windows, and rain periods.
"""

from typing import Dict, Any, List, Optional
import datetime

class RainEvaluator:
    @staticmethod
    def evaluate_rain(location: str, date_iso: str, time_range: Optional[str], hourly_series: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates rain periods and dry windows from hourly data.
        """
        # Filter slots to the target date
        slots = [
            s for s in hourly_series
            if s.get("date") == date_iso or str(s.get("time_iso", "")).startswith(date_iso)
        ]
        
        # If no slots found for exact date, fallback to first 24 slots (if any)
        if not slots:
            slots = hourly_series[:24]

        # Further filter by time_range if provided
        if time_range:
            range_bounds = {
                "morning": (6, 11),
                "afternoon": (12, 16),
                "evening": (17, 21),
                "night": (22, 23)
            }
            if time_range == "night":
                slots = [s for s in slots if s.get("hour") is not None and (s.get("hour") >= 22 or s.get("hour") <= 5)]
            elif time_range in range_bounds:
                start_hr, end_hr = range_bounds[time_range]
                slots = [s for s in slots if s.get("hour") is not None and start_hr <= s.get("hour") <= end_hr]

        if not slots:
            return {
                "location": location,
                "target_date": date_iso,
                "time_range": time_range,
                "summary": "No hourly data available for this time.",
                "overall_chance": 0,
                "total_precipitation_mm": 0.0,
                "rain_periods": [],
                "dry_windows": [],
                "slots": []
            }

        max_chance = 0
        total_precip = 0.0
        
        for s in slots:
            prob = s.get("precipitation_probability", s.get("rain_probability_pct", s.get("rainChance", 0)))
            precip = s.get("precipitation_mm", s.get("precipitation", 0.0))
            if prob > max_chance:
                max_chance = prob
            total_precip += precip

        # Identify contiguous periods
        rain_periods = []
        dry_windows = []
        
        current_rain_period = None
        current_dry_window = None

        for s in slots:
            prob = s.get("precipitation_probability", s.get("rain_probability_pct", s.get("rainChance", 0)))
            time_label = f"{s.get('hour', 0):02d}:00"
            
            # Rain period: >= 30%
            if prob >= 30:
                if current_rain_period is None:
                    current_rain_period = {"start_time": time_label, "end_time": time_label, "max_chance": prob}
                else:
                    current_rain_period["end_time"] = time_label
                    if prob > current_rain_period["max_chance"]:
                        current_rain_period["max_chance"] = prob
            else:
                if current_rain_period is not None:
                    rain_periods.append(current_rain_period)
                    current_rain_period = None
                    
            # Dry window: < 15%
            if prob < 15:
                if current_dry_window is None:
                    current_dry_window = {"start_time": time_label, "end_time": time_label}
                else:
                    current_dry_window["end_time"] = time_label
            else:
                if current_dry_window is not None:
                    dry_windows.append(current_dry_window)
                    current_dry_window = None

        if current_rain_period is not None:
            rain_periods.append(current_rain_period)
        if current_dry_window is not None:
            dry_windows.append(current_dry_window)

        # Generate Summary
        if max_chance < 15:
            summary = f"No significant rain expected for {location}."
        elif not rain_periods and max_chance < 30:
            summary = f"Slight chance of rain ({round(max_chance)}%), but mostly dry."
        elif rain_periods and dry_windows:
            summary = f"Rain expected. Best dry window is from {dry_windows[0]['start_time']} to {dry_windows[0]['end_time']}."
        elif rain_periods:
            summary = f"Continuous rain expected, reaching up to {round(max_chance)}% probability."
        else:
            summary = f"Mixed conditions with {round(max_chance)}% peak rain chance."

        return {
            "location": location,
            "target_date": date_iso,
            "time_range": time_range,
            "summary": summary,
            "overall_chance": round(max_chance),
            "total_precipitation_mm": round(total_precip, 1),
            "rain_periods": rain_periods,
            "dry_windows": dry_windows,
            "slots": [
                {
                    "time": f"{s.get('hour', 0):02d}:00",
                    "precipitation_probability": s.get("precipitation_probability", s.get("rain_probability_pct", s.get("rainChance", 0))),
                    "precipitation_mm": s.get("precipitation_mm", s.get("precipitation", 0.0)),
                    "condition": s.get("condition", "Cloudy"),
                    "temperature_c": s.get("temperature_c", s.get("tempC", 25))
                } for s in slots
            ]
        }
