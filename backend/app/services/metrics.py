"""
System Health & Performance Metrics Service
Tracks cache hit rate, latency, WebSocket connections, and request stats.
"""

import logging
import time
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from collections import defaultdict

logger = logging.getLogger("skycast.metrics")


class MetricsCollector:
    """
    Collects and tracks system performance metrics.
    Used for /api/system/metrics endpoint and admin dashboards.
    """

    def __init__(self):
        self.start_time = datetime.now(timezone.utc)
        self.cache_hits = 0
        self.cache_misses = 0
        self.request_count = 0
        self.request_latencies = []  # List of latencies for averaging
        self.active_websocket_connections = 0
        self.endpoint_request_counts: Dict[str, int] = defaultdict(int)
        self.endpoint_latencies: Dict[str, list] = defaultdict(list)

    def record_cache_hit(self, key: str = ""):
        """Record a successful cache hit."""
        self.cache_hits += 1
        logger.debug(f"Cache hit: {key}")

    def record_cache_miss(self, key: str = ""):
        """Record a cache miss."""
        self.cache_misses += 1
        logger.debug(f"Cache miss: {key}")

    def record_request(self, endpoint: str, latency_ms: float):
        """Record an API request and its latency."""
        self.request_count += 1
        self.request_latencies.append(latency_ms)
        self.endpoint_request_counts[endpoint] += 1
        self.endpoint_latencies[endpoint].append(latency_ms)

        # Keep last 1000 latencies to avoid memory bloat
        if len(self.request_latencies) > 1000:
            self.request_latencies = self.request_latencies[-1000:]

    def record_websocket_connect(self):
        """Record WebSocket connection opened."""
        self.active_websocket_connections += 1
        logger.info(f"WebSocket connected. Active: {self.active_websocket_connections}")

    def record_websocket_disconnect(self):
        """Record WebSocket connection closed."""
        self.active_websocket_connections = max(0, self.active_websocket_connections - 1)
        logger.info(f"WebSocket disconnected. Active: {self.active_websocket_connections}")

    def get_cache_hit_rate(self) -> float:
        """Calculate cache hit rate (0-100%)."""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return (self.cache_hits / total) * 100

    def get_average_latency_ms(self) -> float:
        """Calculate average request latency in milliseconds."""
        if not self.request_latencies:
            return 0.0
        return sum(self.request_latencies) / len(self.request_latencies)

    def get_p95_latency_ms(self) -> float:
        """Calculate 95th percentile latency."""
        if not self.request_latencies:
            return 0.0
        sorted_latencies = sorted(self.request_latencies)
        p95_index = int(len(sorted_latencies) * 0.95)
        return sorted_latencies[min(p95_index, len(sorted_latencies) - 1)]

    def get_p99_latency_ms(self) -> float:
        """Calculate 99th percentile latency."""
        if not self.request_latencies:
            return 0.0
        sorted_latencies = sorted(self.request_latencies)
        p99_index = int(len(sorted_latencies) * 0.99)
        return sorted_latencies[min(p99_index, len(sorted_latencies) - 1)]

    def get_uptime_seconds(self) -> float:
        """Calculate uptime in seconds."""
        elapsed = datetime.now(timezone.utc) - self.start_time
        return elapsed.total_seconds()

    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Return a comprehensive metrics summary for the dashboard.
        """
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": self.get_uptime_seconds(),
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate_pct": round(self.get_cache_hit_rate(), 2)
            },
            "requests": {
                "total_count": self.request_count,
                "average_latency_ms": round(self.get_average_latency_ms(), 2),
                "p95_latency_ms": round(self.get_p95_latency_ms(), 2),
                "p99_latency_ms": round(self.get_p99_latency_ms(), 2),
                "by_endpoint": {
                    endpoint: {
                        "count": count,
                        "avg_latency_ms": round(
                            sum(self.endpoint_latencies[endpoint]) / len(self.endpoint_latencies[endpoint]),
                            2
                        ) if self.endpoint_latencies[endpoint] else 0
                    }
                    for endpoint, count in self.endpoint_request_counts.items()
                }
            },
            "websockets": {
                "active_connections": self.active_websocket_connections
            }
        }


# Global metrics instance
metrics_collector = MetricsCollector()
