import time
import threading
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from datetime import datetime, timedelta
import json
import os
from logging_config import get_logger

logger = get_logger("metrics_collector")

@dataclass
class MetricPoint:
    """Individual metric data point."""
    timestamp: float
    value: float
    labels: Dict[str, str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "timestamp": self.timestamp,
            "value": self.value,
            "labels": self.labels
        }

@dataclass
class RequestMetrics:
    """Metrics for a single request."""
    request_id: str
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    prompt_length: int
    sql_length: int
    model_used: str
    success: bool
    error_type: Optional[str]
    timestamp: float
    client_ip: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

class MetricsCollector:
    """
    Advanced metrics collection system for monitoring Ollama service performance,
    health, and usage patterns.
    """
    
    def __init__(self, retention_hours: int = 24, max_points_per_metric: int = 10000):
        """
        Initialize metrics collector.
        
        Args:
            retention_hours: How long to keep metrics data
            max_points_per_metric: Maximum data points per metric
        """
        self.retention_hours = retention_hours
        self.max_points_per_metric = max_points_per_metric
        
        # Thread-safe storage
        self._lock = threading.RLock()
        
        # Metric storage
        self._metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_points_per_metric))
        self._request_metrics: deque = deque(maxlen=max_points_per_metric)
        
        # Counters
        self._counters: Dict[str, int] = defaultdict(int)
        
        # Gauges (current values)
        self._gauges: Dict[str, float] = {}
        
        # Histograms (for response time distribution)
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        
        # Start cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_old_metrics, daemon=True)
        self._cleanup_thread.start()
        
        logger.info("Metrics collector initialized", extra={
            "retention_hours": retention_hours,
            "max_points_per_metric": max_points_per_metric
        })
    
    def record_counter(self, name: str, value: int = 1, labels: Optional[Dict[str, str]] = None):
        """
        Record a counter metric (monotonically increasing).
        
        Args:
            name: Metric name
            value: Value to add to counter
            labels: Optional labels for the metric
        """
        with self._lock:
            metric_key = self._get_metric_key(name, labels or {})
            self._counters[metric_key] += value
            
            # Also store as time series
            point = MetricPoint(
                timestamp=time.time(),
                value=self._counters[metric_key],
                labels=labels or {}
            )
            self._metrics[name].append(point)
    
    def record_gauge(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """
        Record a gauge metric (current value).
        
        Args:
            name: Metric name
            value: Current value
            labels: Optional labels for the metric
        """
        with self._lock:
            metric_key = self._get_metric_key(name, labels or {})
            self._gauges[metric_key] = value
            
            # Also store as time series
            point = MetricPoint(
                timestamp=time.time(),
                value=value,
                labels=labels or {}
            )
            self._metrics[name].append(point)
    
    def record_histogram(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """
        Record a histogram metric (for distribution analysis).
        
        Args:
            name: Metric name
            value: Value to add to histogram
            labels: Optional labels for the metric
        """
        with self._lock:
            metric_key = self._get_metric_key(name, labels or {})
            self._histograms[metric_key].append(value)
            
            # Keep only recent values for histogram
            if len(self._histograms[metric_key]) > 1000:
                self._histograms[metric_key] = self._histograms[metric_key][-1000:]
            
            # Also store as time series
            point = MetricPoint(
                timestamp=time.time(),
                value=value,
                labels=labels or {}
            )
            self._metrics[name].append(point)
    
    def record_request(self, request_metrics: RequestMetrics):
        """
        Record comprehensive request metrics.
        
        Args:
            request_metrics: Request metrics data
        """
        with self._lock:
            self._request_metrics.append(request_metrics)
            
            # Update derived metrics
            self.record_counter("requests_total", 1, {
                "endpoint": request_metrics.endpoint,
                "method": request_metrics.method,
                "status": str(request_metrics.status_code)
            })
            
            self.record_histogram("request_duration_ms", request_metrics.response_time_ms, {
                "endpoint": request_metrics.endpoint
            })
            
            self.record_histogram("prompt_length", request_metrics.prompt_length)
            self.record_histogram("sql_length", request_metrics.sql_length)
            
            if request_metrics.model_used:
                self.record_counter("model_usage", 1, {
                    "model": request_metrics.model_used
                })
            
            if not request_metrics.success:
                self.record_counter("errors_total", 1, {
                    "error_type": request_metrics.error_type or "unknown",
                    "endpoint": request_metrics.endpoint
                })
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get comprehensive metrics summary.
        
        Returns:
            Dict containing all metrics data
        """
        with self._lock:
            current_time = time.time()
            
            # Calculate time windows
            last_hour = current_time - 3600
            last_day = current_time - 86400
            
            # Recent requests
            recent_requests = [
                req for req in self._request_metrics
                if req.timestamp > last_hour
            ]
            
            daily_requests = [
                req for req in self._request_metrics
                if req.timestamp > last_day
            ]
            
            # Calculate success rates
            hourly_success_rate = self._calculate_success_rate(recent_requests)
            daily_success_rate = self._calculate_success_rate(daily_requests)
            
            # Calculate response time percentiles
            recent_response_times = [req.response_time_ms for req in recent_requests]
            response_time_percentiles = self._calculate_percentiles(recent_response_times)
            
            # Model usage statistics
            model_usage = self._calculate_model_usage(daily_requests)
            
            # Error statistics
            error_stats = self._calculate_error_stats(daily_requests)
            
            return {
                "timestamp": current_time,
                "collection_period_hours": self.retention_hours,
                "total_requests": len(self._request_metrics),
                "requests_last_hour": len(recent_requests),
                "requests_last_day": len(daily_requests),
                "success_rates": {
                    "last_hour": hourly_success_rate,
                    "last_day": daily_success_rate
                },
                "response_times": {
                    "last_hour_percentiles": response_time_percentiles,
                    "average_ms": sum(recent_response_times) / len(recent_response_times) if recent_response_times else 0
                },
                "model_usage": model_usage,
                "error_statistics": error_stats,
                "counters": dict(self._counters),
                "gauges": dict(self._gauges)
            }
    
    def get_time_series(self, metric_name: str, hours: int = 1) -> List[Dict[str, Any]]:
        """
        Get time series data for a specific metric.
        
        Args:
            metric_name: Name of the metric
            hours: Number of hours of data to return
            
        Returns:
            List of metric points
        """
        with self._lock:
            cutoff_time = time.time() - (hours * 3600)
            
            if metric_name not in self._metrics:
                return []
            
            return [
                point.to_dict() for point in self._metrics[metric_name]
                if point.timestamp > cutoff_time
            ]
    
    def get_request_history(self, hours: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent request history.
        
        Args:
            hours: Number of hours of history to return
            limit: Maximum number of requests to return
            
        Returns:
            List of request metrics
        """
        with self._lock:
            cutoff_time = time.time() - (hours * 3600)
            
            recent_requests = [
                req.to_dict() for req in self._request_metrics
                if req.timestamp > cutoff_time
            ]
            
            # Sort by timestamp (most recent first) and limit
            recent_requests.sort(key=lambda x: x['timestamp'], reverse=True)
            return recent_requests[:limit]
    
    def get_performance_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive performance report.
        
        Returns:
            Dict containing performance analysis
        """
        with self._lock:
            current_time = time.time()
            
            # Get requests from different time windows
            last_hour_requests = [
                req for req in self._request_metrics
                if req.timestamp > current_time - 3600
            ]
            
            last_day_requests = [
                req for req in self._request_metrics
                if req.timestamp > current_time - 86400
            ]
            
            # Performance analysis
            report = {
                "generated_at": current_time,
                "time_windows": {
                    "last_hour": self._analyze_requests(last_hour_requests),
                    "last_day": self._analyze_requests(last_day_requests)
                },
                "trends": self._calculate_trends(),
                "recommendations": self._generate_recommendations(last_hour_requests)
            }
            
            return report
    
    def export_metrics(self, format_type: str = "json") -> str:
        """
        Export metrics in various formats.
        
        Args:
            format_type: Export format (json, prometheus)
            
        Returns:
            Formatted metrics string
        """
        if format_type == "json":
            return json.dumps(self.get_metrics_summary(), indent=2)
        elif format_type == "prometheus":
            return self._export_prometheus_format()
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def _get_metric_key(self, name: str, labels: Dict[str, str]) -> str:
        """Generate unique key for metric with labels."""
        if not labels:
            return name
        
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"
    
    def _calculate_success_rate(self, requests: List[RequestMetrics]) -> float:
        """Calculate success rate for a list of requests."""
        if not requests:
            return 0.0
        
        successful = sum(1 for req in requests if req.success)
        return (successful / len(requests)) * 100
    
    def _calculate_percentiles(self, values: List[float]) -> Dict[str, float]:
        """Calculate percentiles for a list of values."""
        if not values:
            return {"p50": 0, "p90": 0, "p95": 0, "p99": 0}
        
        sorted_values = sorted(values)
        n = len(sorted_values)
        
        return {
            "p50": sorted_values[int(n * 0.5)],
            "p90": sorted_values[int(n * 0.9)],
            "p95": sorted_values[int(n * 0.95)],
            "p99": sorted_values[int(n * 0.99)]
        }
    
    def _calculate_model_usage(self, requests: List[RequestMetrics]) -> Dict[str, Any]:
        """Calculate model usage statistics."""
        model_counts = defaultdict(int)
        model_response_times = defaultdict(list)
        
        for req in requests:
            if req.model_used:
                model_counts[req.model_used] += 1
                model_response_times[req.model_used].append(req.response_time_ms)
        
        usage_stats = {}
        for model, count in model_counts.items():
            response_times = model_response_times[model]
            usage_stats[model] = {
                "request_count": count,
                "percentage": (count / len(requests)) * 100 if requests else 0,
                "avg_response_time_ms": sum(response_times) / len(response_times) if response_times else 0,
                "percentiles": self._calculate_percentiles(response_times)
            }
        
        return usage_stats
    
    def _calculate_error_stats(self, requests: List[RequestMetrics]) -> Dict[str, Any]:
        """Calculate error statistics."""
        error_counts = defaultdict(int)
        total_errors = 0
        
        for req in requests:
            if not req.success:
                error_type = req.error_type or "unknown"
                error_counts[error_type] += 1
                total_errors += 1
        
        return {
            "total_errors": total_errors,
            "error_rate": (total_errors / len(requests)) * 100 if requests else 0,
            "error_types": dict(error_counts)
        }
    
    def _analyze_requests(self, requests: List[RequestMetrics]) -> Dict[str, Any]:
        """Analyze a list of requests for performance metrics."""
        if not requests:
            return {"request_count": 0}
        
        response_times = [req.response_time_ms for req in requests]
        prompt_lengths = [req.prompt_length for req in requests]
        sql_lengths = [req.sql_length for req in requests]
        
        return {
            "request_count": len(requests),
            "success_rate": self._calculate_success_rate(requests),
            "response_times": {
                "average_ms": sum(response_times) / len(response_times),
                "percentiles": self._calculate_percentiles(response_times)
            },
            "prompt_stats": {
                "average_length": sum(prompt_lengths) / len(prompt_lengths),
                "percentiles": self._calculate_percentiles(prompt_lengths)
            },
            "sql_stats": {
                "average_length": sum(sql_lengths) / len(sql_lengths),
                "percentiles": self._calculate_percentiles(sql_lengths)
            }
        }
    
    def _calculate_trends(self) -> Dict[str, Any]:
        """Calculate performance trends over time."""
        # This is a simplified trend calculation
        # In a real implementation, you might use more sophisticated time series analysis
        
        current_time = time.time()
        hour_ago = current_time - 3600
        two_hours_ago = current_time - 7200
        
        recent_requests = [req for req in self._request_metrics if req.timestamp > hour_ago]
        previous_requests = [req for req in self._request_metrics if two_hours_ago < req.timestamp <= hour_ago]
        
        recent_avg_response = sum(req.response_time_ms for req in recent_requests) / len(recent_requests) if recent_requests else 0
        previous_avg_response = sum(req.response_time_ms for req in previous_requests) / len(previous_requests) if previous_requests else 0
        
        response_time_trend = "stable"
        if recent_avg_response > previous_avg_response * 1.1:
            response_time_trend = "increasing"
        elif recent_avg_response < previous_avg_response * 0.9:
            response_time_trend = "decreasing"
        
        return {
            "response_time_trend": response_time_trend,
            "request_volume_trend": "stable",  # Simplified
            "error_rate_trend": "stable"  # Simplified
        }
    
    def _generate_recommendations(self, recent_requests: List[RequestMetrics]) -> List[str]:
        """Generate performance recommendations based on recent data."""
        recommendations = []
        
        if not recent_requests:
            return ["No recent requests to analyze"]
        
        # Analyze response times
        response_times = [req.response_time_ms for req in recent_requests]
        avg_response_time = sum(response_times) / len(response_times)
        
        if avg_response_time > 10000:  # 10 seconds
            recommendations.append("Consider using a smaller/faster model for better response times")
        
        # Analyze error rate
        error_rate = (1 - self._calculate_success_rate(recent_requests) / 100)
        if error_rate > 0.05:  # 5% error rate
            recommendations.append("High error rate detected - check Ollama server health and model availability")
        
        # Analyze prompt lengths
        prompt_lengths = [req.prompt_length for req in recent_requests]
        avg_prompt_length = sum(prompt_lengths) / len(prompt_lengths)
        
        if avg_prompt_length > 1000:
            recommendations.append("Long prompts detected - consider prompt optimization for better performance")
        
        if not recommendations:
            recommendations.append("System performance is within normal parameters")
        
        return recommendations
    
    def _export_prometheus_format(self) -> str:
        """Export metrics in Prometheus format."""
        lines = []
        
        # Export counters
        for metric_key, value in self._counters.items():
            lines.append(f"ollama_counter_{metric_key} {value}")
        
        # Export gauges
        for metric_key, value in self._gauges.items():
            lines.append(f"ollama_gauge_{metric_key} {value}")
        
        return "\n".join(lines)
    
    def _cleanup_old_metrics(self):
        """Background thread to clean up old metrics data."""
        while True:
            try:
                time.sleep(3600)  # Run every hour
                
                cutoff_time = time.time() - (self.retention_hours * 3600)
                
                with self._lock:
                    # Clean up time series data
                    for metric_name in list(self._metrics.keys()):
                        metric_data = self._metrics[metric_name]
                        # Remove old points
                        while metric_data and metric_data[0].timestamp < cutoff_time:
                            metric_data.popleft()
                    
                    # Clean up request metrics
                    while self._request_metrics and self._request_metrics[0].timestamp < cutoff_time:
                        self._request_metrics.popleft()
                    
                    # Clean up histograms
                    for metric_key in list(self._histograms.keys()):
                        # Keep only recent histogram data
                        self._histograms[metric_key] = self._histograms[metric_key][-1000:]
                
                logger.info("Metrics cleanup completed", extra={
                    "cutoff_time": cutoff_time,
                    "retention_hours": self.retention_hours
                })
                
            except Exception as e:
                logger.error(f"Error during metrics cleanup: {e}")


# Global metrics collector instance
metrics_collector = MetricsCollector(
    retention_hours=int(os.getenv("METRICS_RETENTION_HOURS", "24")),
    max_points_per_metric=int(os.getenv("MAX_POINTS_PER_METRIC", "10000"))
)