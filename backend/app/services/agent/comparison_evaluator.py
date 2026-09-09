"""
Comparison Evaluator for WeatherGPT
Provides deterministic evaluation and scoring for location and date comparisons.
"""

import datetime
from typing import Dict, Any, List, Optional
from backend.app.services.agent.activity_evaluator import ActivityEvaluator, ACTIVITY_POLICIES
from backend.app.services.weather_hub import weather_hub

class ComparisonEvaluator:
    @classmethod
    def score_weather(cls, daily_data: Dict[str, Any], activity: Optional[str] = None) -> float:
        """
        Scores a day's weather. If activity is provided, uses ActivityEvaluator policy.
        Otherwise, uses a generic 'good weather' metric (no rain, moderate temp).
        """
        if not activity or activity not in ACTIVITY_POLICIES:
            score = 100.0
            rain = daily_data.get("precipitation_probability", 0)
            if rain > 20:
                score -= (rain / 2.0)
                
            temp = daily_data.get("temperature_max_c", 25)
            if temp > 35:
                score -= (temp - 35) * 5
            elif temp < 10:
                score -= (10 - temp) * 5
                
            return max(0.0, min(100.0, score))
            
        policy = ACTIVITY_POLICIES[activity]
        score = 100.0
        rain = daily_data.get("precipitation_probability", 0)
        
        if policy.get("rain_penalty") == "high" and rain > 30:
            score -= 50
        elif policy.get("rain_penalty") == "medium" and rain > 50:
            score -= 30
            
        temp = daily_data.get("temperature_max_c", 25)
        opt_min, opt_max = policy.get("temp_optimal", (20, 30))
        if temp > opt_max:
            score -= (temp - opt_max) * 4
        elif temp < opt_min:
            score -= (opt_min - temp) * 4
            
        return max(0.0, min(100.0, score))

    @classmethod
    async def evaluate_locations(cls, locations: List[str], date_iso: Optional[str], activity: Optional[str] = None) -> Dict[str, Any]:
        results = []
        best_score = -1.0
        winner = None
        
        target_date = date_iso or datetime.date.today().isoformat()
        
        for loc in locations:
            try:
                forecast = await weather_hub.get_forecast_for_city(loc, days=7)
                daily_list = forecast.get("daily", [])
                day_data = next((d for d in daily_list if d.get("date") == target_date), None)
                
                if not day_data:
                    # Fallback to current weather or general forecast if date not found
                    if len(daily_list) > 0:
                        day_data = daily_list[0]
                    else:
                        continue
                    
                score = cls.score_weather(day_data, activity)
                results.append({
                    "location": loc,
                    "score": round(score, 1),
                    "temperature_max_c": day_data.get("temperature_max_c", 0),
                    "temperature_min_c": day_data.get("temperature_min_c", 0),
                    "condition": day_data.get("condition", "Unknown"),
                    "precipitation_probability": day_data.get("precipitation_probability", 0)
                })
                
                if score > best_score:
                    best_score = score
                    winner = loc
            except Exception:
                continue
                
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "winner": winner,
            "activity": activity,
            "target_date": target_date,
            "comparisons": results
        }

    @classmethod
    async def evaluate_dates(cls, location: str, dates: List[str], activity: Optional[str] = None) -> Dict[str, Any]:
        results = []
        best_score = -1.0
        winner = None
        
        try:
            forecast = await weather_hub.get_forecast_for_city(location, days=7)
            daily_list = forecast.get("daily", [])
            
            for d_iso in dates:
                day_data = next((d for d in daily_list if d.get("date") == d_iso), None)
                if not day_data:
                    continue
                    
                score = cls.score_weather(day_data, activity)
                results.append({
                    "date": d_iso,
                    "score": round(score, 1),
                    "temperature_max_c": day_data.get("temperature_max_c", 0),
                    "temperature_min_c": day_data.get("temperature_min_c", 0),
                    "condition": day_data.get("condition", "Unknown"),
                    "precipitation_probability": day_data.get("precipitation_probability", 0)
                })
                
                if score > best_score:
                    best_score = score
                    winner = d_iso
                    
            results.sort(key=lambda x: x["score"], reverse=True)
        except Exception:
            pass
            
        verdict = "Conditions are comparable across these dates."
        if winner and len(results) >= 2:
            best = results[0]
            runner_up = results[1]
            if best["score"] - runner_up["score"] > 15:
                if best["date"] == datetime.date.today().isoformat():
                    verdict = "Today is significantly better."
                elif best["date"] == (datetime.date.today() + datetime.timedelta(days=1)).isoformat():
                    verdict = "Tomorrow is significantly better."
                else:
                    verdict = f"{best['date']} is the best option."
            elif best["score"] - runner_up["score"] > 5:
                verdict = f"{best['date']} is slightly better."

        return {
            "location": location,
            "winner": winner,
            "activity": activity,
            "verdict": verdict,
            "comparisons": results
        }
