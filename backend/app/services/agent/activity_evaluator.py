"""
Activity Evaluator Module
Provides deterministic scoring and best-time recommendation for outdoor activities based on weather data.
"""

from typing import Dict, Any, List, Optional
import datetime

# Predefined policies for activities
ACTIVITY_POLICIES = {
    "cricket": {
        "rain_penalty": 2.0,
        "temp_optimal": (20, 32),
        "wind_penalty": 1.5,
        "daylight_required": True
    },
    "running": {
        "rain_penalty": 1.5,
        "temp_optimal": (10, 25),
        "wind_penalty": 1.0,
        "daylight_required": False
    },
    "hiking": {
        "rain_penalty": 2.5,
        "temp_optimal": (15, 25),
        "wind_penalty": 1.0,
        "daylight_required": True
    },
    "trekking": {
        "rain_penalty": 2.5,
        "temp_optimal": (15, 25),
        "wind_penalty": 1.0,
        "daylight_required": True
    },
    "outdoor_event": {
        "rain_penalty": 3.0,
        "temp_optimal": (18, 28),
        "wind_penalty": 1.5,
        "daylight_required": False
    },
    "picnic": {
        "rain_penalty": 3.0,
        "temp_optimal": (20, 28),
        "wind_penalty": 1.5,
        "daylight_required": True
    }
}

class ActivityEvaluator:
    @staticmethod
    def evaluate_best_time(activity: str, hourly_slots: List[Dict[str, Any]], target_date_iso: str) -> Optional[Dict[str, Any]]:
        """
        Scans hourly slots to find the best time window for the given activity.
        """
        act_key = activity.lower().replace(" ", "_")
        policy = ACTIVITY_POLICIES.get(act_key, {
            "rain_penalty": 2.0,
            "temp_optimal": (18, 30),
            "wind_penalty": 1.0,
            "daylight_required": False
        })
        
        valid_slots = []
        for s in hourly_slots:
            hour = s.get("hour")
            if hour is None and ":" in str(s.get("time", "")):
                try:
                    hour = int(str(s.get("time")).split(":")[0])
                except Exception:
                    continue
                    
            if hour is None:
                continue
                
            # Filter by daylight if required
            if policy["daylight_required"]:
                # Rough estimate: 6 AM to 6 PM (18:00)
                # In the future, this can be enhanced with actual sunrise/sunset data
                if not (6 <= hour <= 18):
                    continue
                    
            valid_slots.append((hour, s))
            
        if not valid_slots:
            return None
            
        scored_slots = []
        for hour, s in valid_slots:
            rain = float(s.get("precipitation_probability", s.get("rainChance", s.get("rain_probability_pct", 0))))
            temp = float(s.get("temperature_c", s.get("tempC", 25)))
            wind = float(s.get("wind_speed_kmh", s.get("windSpeed", 10)))
            
            score = 100.0
            
            # Rain penalty
            score -= (rain * policy["rain_penalty"])
            
            # Temp penalty
            min_opt, max_opt = policy["temp_optimal"]
            if temp < min_opt:
                score -= (min_opt - temp) * 2
            elif temp > max_opt:
                score -= (temp - max_opt) * 2
                
            # Wind penalty
            if wind > 20:
                score -= (wind - 20) * policy["wind_penalty"]
                
            scored_slots.append({
                "hour": hour,
                "score": max(0, score),
                "data": s,
                "rain": rain,
                "temp": temp,
                "wind": wind
            })
            
        if not scored_slots:
            return None
            
        # Sort by score descending
        scored_slots.sort(key=lambda x: x["score"], reverse=True)
        
        best_slot = scored_slots[0]
        
        # Rating categorization
        score_val = best_slot["score"]
        if score_val >= 80:
            rating = "favorable"
        elif score_val >= 50:
            rating = "marginal"
        else:
            rating = "unfavorable"
            
        no_suitable_window = (rating == "unfavorable")

        target_hour = best_slot["hour"]
        cond_val = best_slot["data"].get("condition", "Cloudy")
        temp_val = best_slot["temp"]
        rain_pct = best_slot["rain"]
        
        factors = []
        if rain_pct < 10:
            factors.append(f"No rain expected")
        elif rain_pct >= 50:
            factors.append(f"High rain risk ({round(rain_pct)}%)")
            
        factors.append(f"Temperature {round(temp_val)}°C")
            
        if rating == "favorable":
            recommendation = f"Optimal time identified! {target_hour:02d}:00 offers {cond_val} conditions."
        elif rating == "marginal":
            recommendation = f"The best window is around {target_hour:02d}:00, but still carries some weather risk."
        else:
            recommendation = f"No highly favorable time found today due to expected weather."
            
        alternatives = []
        for alt in scored_slots[1:3]:
            alt_rating = "favorable" if alt["score"] >= 80 else ("marginal" if alt["score"] >= 50 else "unfavorable")
            alternatives.append({
                "start": f"{alt['hour']:02d}:00",
                "end": f"{(alt['hour'] + 1):02d}:00",
                "score": round(alt["score"]),
                "rating": alt_rating
            })
            
        return {
            "activity": activity,
            "date": target_date_iso,
            "recommended_start": f"{target_hour:02d}:00",
            "recommended_end": f"{(target_hour + 1):02d}:00",
            "score": round(score_val),
            "status": rating,  # for compatibility with frontend ActivitySuitabilityCard
            "rating": rating,
            "no_suitable_window": no_suitable_window,
            "reason": "Analyzed hourly data based on activity requirements.",
            "recommendation": recommendation,
            "factors": factors,
            "alternatives": alternatives,
            "target_time": f"{target_hour:02d}:00",
            "target_date": target_date_iso,
            "precipitation_probability": round(rain_pct),
            "temperature_c": round(temp_val),
            "condition": cond_val
        }
