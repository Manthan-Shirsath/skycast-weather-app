from typing import List, Dict, Any
from backend.app.models.forecast import ForecastRun
import datetime
from backend.app.core.model_registry import MODEL_REGISTRY

class ForecastAnalytics:
    """
    Deterministic engine for computing multi-model forecast consensus, methodology comparisons,
    and ensemble uncertainty.
    """
    
    # Thresholds for agreement visualization heuristic
    THRESHOLDS = {
        "temperature_2m": {"high": 1.0, "moderate": 2.0},
        "temperature": {"high": 1.0, "moderate": 2.0},
        "precipitation": {"high": 1.0, "moderate": 5.0},
        "precipitation_probability": {"high": 10.0, "moderate": 25.0},
        "wind_speed_10m": {"high": 3.0, "moderate": 8.0},
        "wind_speed": {"high": 3.0, "moderate": 8.0},
    }

    @classmethod
    def analyze(cls, runs: List[ForecastRun]) -> Dict[str, Any]:
        # variable -> valid_time -> { 'models': {model_id: val}, 'ensemble_spreads': {model_id: val} }
        var_time_map: Dict[str, Dict[datetime.datetime, Dict[str, Dict[str, float]]]] = {}
        var_units: Dict[str, str] = {}
        
        # 1. Align data by valid_time and variable
        for run in runs:
            model_id = run.model_id
            for val in run.values:
                # Fallback to 'deterministic' if representation doesn't exist on older schemas before migration fully applies
                rep = getattr(val, "representation", "deterministic")
                
                if val.variable not in var_time_map:
                    var_time_map[val.variable] = {}
                    var_units[val.variable] = val.unit
                
                vt = val.valid_time
                if vt not in var_time_map[val.variable]:
                    var_time_map[val.variable][vt] = {"models": {}, "ensemble_spreads": {}}
                    
                if rep in ("deterministic", "ensemble_mean"):
                    var_time_map[val.variable][vt]["models"][model_id] = val.value
                elif rep == "ensemble_spread":
                    var_time_map[val.variable][vt]["ensemble_spreads"][model_id] = val.value
                
        # 2. Compute analytics per variable
        analytics_result = {}
        
        for variable, time_map in var_time_map.items():
            thresholds = cls.THRESHOLDS.get(variable, {"high": 2.0, "moderate": 5.0})
            
            timestamps = sorted(time_map.keys())
            timeline = []
            
            overall_spreads = []
            
            for t in timestamps:
                data = time_map[t]
                models_dict = data["models"]
                spreads_dict = data["ensemble_spreads"]
                
                if not models_dict:
                    continue
                    
                vals = list(models_dict.values())
                v_min = min(vals)
                v_max = max(vals)
                model_disagreement = v_max - v_min
                consensus = sum(vals) / len(vals)
                
                if model_disagreement <= thresholds["high"]:
                    agreement = "high"
                elif model_disagreement <= thresholds["moderate"]:
                    agreement = "moderate"
                else:
                    agreement = "low"
                    
                overall_spreads.append(model_disagreement)
                
                # Compute methodology groupings
                methodologies: Dict[str, List[float]] = {}
                for m_id, m_val in models_dict.items():
                    meth = MODEL_REGISTRY.get(m_id, {}).get("methodology", "unknown")
                    if meth not in methodologies:
                        methodologies[meth] = []
                    methodologies[meth].append(m_val)
                
                meth_consensus = {}
                for meth, m_vals in methodologies.items():
                    meth_consensus[meth] = sum(m_vals) / len(m_vals)
                    
                # Pairwise differences
                pairwise = {}
                meth_keys = list(meth_consensus.keys())
                for i in range(len(meth_keys)):
                    for j in range(i + 1, len(meth_keys)):
                        m1, m2 = meth_keys[i], meth_keys[j]
                        pairwise[f"{m1}_vs_{m2}_difference"] = abs(meth_consensus[m1] - meth_consensus[m2])

                timeline.append({
                    "timestamp": t.isoformat(),
                    "consensus": round(consensus, 2),
                    "min": round(v_min, 2),
                    "max": round(v_max, 2),
                    "model_disagreement": round(model_disagreement, 2),
                    "model_count": len(vals),
                    "agreement": agreement,
                    "methodology_consensus": {k: round(v, 2) for k, v in meth_consensus.items()},
                    "pairwise_differences": {k: round(v, 2) for k, v in pairwise.items()},
                    "ensemble_spreads": {k: round(v, 2) for k, v in spreads_dict.items()}
                })
                
            if not timeline:
                continue
                
            # Aggregate Daily Periods
            daily_agreement = {}
            for entry in timeline:
                day = entry["timestamp"][:10]
                if day not in daily_agreement:
                    daily_agreement[day] = []
                daily_agreement[day].append(entry["model_disagreement"])
                
            periods = []
            for day, day_spreads in daily_agreement.items():
                day_max_spread = max(day_spreads)
                if day_max_spread <= thresholds["high"]:
                    cat = "high"
                elif day_max_spread <= thresholds["moderate"]:
                    cat = "moderate"
                else:
                    cat = "low"
                
                periods.append({
                    "date": day,
                    "agreement": cat,
                    "max_spread": round(day_max_spread, 2)
                })
            
            overall_max_spread = max(overall_spreads) if overall_spreads else 0.0
            
            analytics_result[variable] = {
                "unit": var_units[variable],
                "overall_max_spread": round(overall_max_spread, 2),
                "timeline": timeline,
                "periods": periods
            }
            
        return analytics_result
