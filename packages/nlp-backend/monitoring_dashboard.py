import time
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from metrics_collector import metrics_collector, RequestMetrics
from logging_config import get_logger

logger = get_logger("monitoring_dashboard")

class MonitoringDashboard:
    """
    Real-time monitoring dashboard for Ollama service.
    Provides formatted data for web dashboards and monitoring systems.
    """
    
    def __init__(self):
        """Initialize monitoring dashboard."""
        self.start_time = time.time()
        logger.info("Monitoring dashboard initialized")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        Get comprehensive dashboard data.
        
        Returns:
            Dict containing all dashboard metrics and visualizations
        """
        current_time = time.time()
        uptime_seconds = current_time - self.start_time
        
        # Get metrics summary
        metrics_summary = metrics_collector.get_metrics_summary()
        
        # Get performance report
        performance_report = metrics_collector.get_performance_report()
        
        # Get recent request history
        recent_requests = metrics_collector.get_request_history(hours=1, limit=50)
        
        dashboard_data = {
            "timestamp": current_time,
            "uptime_seconds": uptime_seconds,
            "uptime_formatted": self._format_uptime(uptime_seconds),
            "overview": self._get_overview_metrics(metrics_summary),
            "performance": self._get_performance_metrics(metrics_summary, performance_report),
            "requests": self._get_request_metrics(recent_requests),
            "models": self._get_model_metrics(metrics_summary),
            "errors": self._get_error_metrics(metrics_summary),
            "system": self._get_system_metrics(),
            "alerts": self._get_active_alerts(metrics_summary),
            "charts": self._get_chart_data()
        }
        
        return dashboard_data
    
    def get_real_time_metrics(self) -> Dict[str, Any]:
        """
        Get real-time metrics for live updates.
        
        Returns:
            Dict containing current metrics
        """
        current_time = time.time()
        
        # Get last 5 minutes of data
        recent_requests = metrics_collector.get_request_history(hours=0.083, limit=100)  # 5 minutes
        
        if recent_requests:
            latest_request = recent_requests[0]
            avg_response_time = sum(req['response_time_ms'] for req in recent_requests) / len(recent_requests)
            success_rate = sum(1 for req in recent_requests if req['success']) / len(recent_requests) * 100
        else:
            latest_request = None
            avg_response_time = 0
            success_rate = 0
        
        return {
            "timestamp": current_time,
            "requests_last_5min": len(recent_requests),
            "avg_response_time_ms": round(avg_response_time, 2),
            "success_rate_percent": round(success_rate, 2),
            "latest_request": latest_request,
            "active_connections": self._get_active_connections(),
            "memory_usage_mb": self._get_memory_usage(),
            "cpu_usage_percent": self._get_cpu_usage()
        }
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get overall health status for monitoring systems.
        
        Returns:
            Dict containing health status and key metrics
        """
        metrics_summary = metrics_collector.get_metrics_summary()
        
        # Determine overall health
        health_status = "healthy"
        health_issues = []
        
        # Check success rate
        hourly_success_rate = metrics_summary.get("success_rates", {}).get("last_hour", 0)
        if hourly_success_rate < 95:
            health_status = "degraded"
            health_issues.append(f"Low success rate: {hourly_success_rate:.1f}%")
        
        # Check response times
        avg_response_time = metrics_summary.get("response_times", {}).get("average_ms", 0)
        if avg_response_time > 10000:  # 10 seconds
            health_status = "degraded"
            health_issues.append(f"High response time: {avg_response_time:.0f}ms")
        
        # Check error rate
        error_stats = metrics_summary.get("error_statistics", {})
        error_rate = error_stats.get("error_rate", 0)
        if error_rate > 5:  # 5% error rate
            health_status = "unhealthy"
            health_issues.append(f"High error rate: {error_rate:.1f}%")
        
        return {
            "status": health_status,
            "timestamp": time.time(),
            "issues": health_issues,
            "key_metrics": {
                "success_rate": hourly_success_rate,
                "avg_response_time_ms": avg_response_time,
                "error_rate": error_rate,
                "requests_last_hour": metrics_summary.get("requests_last_hour", 0)
            }
        }
    
    def get_performance_trends(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get performance trends over time.
        
        Args:
            hours: Number of hours to analyze
            
        Returns:
            Dict containing trend analysis
        """
        # Get time series data for key metrics
        response_time_series = metrics_collector.get_time_series("request_duration_ms", hours)
        request_count_series = metrics_collector.get_time_series("requests_total", hours)
        
        # Calculate trends
        trends = {
            "period_hours": hours,
            "response_time_trend": self._calculate_trend(response_time_series),
            "request_volume_trend": self._calculate_trend(request_count_series),
            "peak_hours": self._identify_peak_hours(request_count_series),
            "performance_summary": self._summarize_performance_trends(hours)
        }
        
        return trends
    
    def generate_report(self, report_type: str = "daily") -> Dict[str, Any]:
        """
        Generate comprehensive monitoring report.
        
        Args:
            report_type: Type of report (hourly, daily, weekly)
            
        Returns:
            Dict containing formatted report
        """
        if report_type == "hourly":
            hours = 1
        elif report_type == "daily":
            hours = 24
        elif report_type == "weekly":
            hours = 168
        else:
            hours = 24
        
        current_time = time.time()
        start_time = current_time - (hours * 3600)
        
        # Get comprehensive data
        metrics_summary = metrics_collector.get_metrics_summary()
        performance_report = metrics_collector.get_performance_report()
        request_history = metrics_collector.get_request_history(hours=hours, limit=1000)
        
        report = {
            "report_type": report_type,
            "generated_at": current_time,
            "period": {
                "start_time": start_time,
                "end_time": current_time,
                "duration_hours": hours
            },
            "executive_summary": self._generate_executive_summary(metrics_summary, request_history),
            "performance_analysis": self._analyze_performance(request_history),
            "usage_patterns": self._analyze_usage_patterns(request_history),
            "error_analysis": self._analyze_errors(request_history),
            "recommendations": self._generate_recommendations(metrics_summary, request_history),
            "detailed_metrics": metrics_summary
        }
        
        return report
    
    def _format_uptime(self, uptime_seconds: float) -> str:
        """Format uptime in human-readable format."""
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    
    def _get_overview_metrics(self, metrics_summary: Dict[str, Any]) -> Dict[str, Any]:
        """Get overview metrics for dashboard."""
        return {
            "total_requests": metrics_summary.get("total_requests", 0),
            "requests_last_hour": metrics_summary.get("requests_last_hour", 0),
            "requests_last_day": metrics_summary.get("requests_last_day", 0),
            "success_rate_hour": metrics_summary.get("success_rates", {}).get("last_hour", 0),
            "success_rate_day": metrics_summary.get("success_rates", {}).get("last_day", 0),
            "avg_response_time": metrics_summary.get("response_times", {}).get("average_ms", 0)
        }
    
    def _get_performance_metrics(self, metrics_summary: Dict[str, Any], performance_report: Dict[str, Any]) -> Dict[str, Any]:
        """Get performance metrics for dashboard."""
        response_times = metrics_summary.get("response_times", {})
        percentiles = response_times.get("last_hour_percentiles", {})
        
        return {
            "response_time_percentiles": percentiles,
            "average_response_time": response_times.get("average_ms", 0),
            "trends": performance_report.get("trends", {}),
            "recommendations": performance_report.get("recommendations", [])
        }
    
    def _get_request_metrics(self, recent_requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get request metrics for dashboard."""
        if not recent_requests:
            return {"count": 0, "recent_requests": []}
        
        # Group by endpoint
        endpoint_counts = {}
        for req in recent_requests:
            endpoint = req.get("endpoint", "unknown")
            endpoint_counts[endpoint] = endpoint_counts.get(endpoint, 0) + 1
        
        return {
            "count": len(recent_requests),
            "endpoint_distribution": endpoint_counts,
            "recent_requests": recent_requests[:10]  # Last 10 requests
        }
    
    def _get_model_metrics(self, metrics_summary: Dict[str, Any]) -> Dict[str, Any]:
        """Get model usage metrics for dashboard."""
        model_usage = metrics_summary.get("model_usage", {})
        
        return {
            "usage_distribution": model_usage,
            "total_models": len(model_usage),
            "most_used_model": max(model_usage.keys(), key=lambda k: model_usage[k]["request_count"]) if model_usage else None
        }
    
    def _get_error_metrics(self, metrics_summary: Dict[str, Any]) -> Dict[str, Any]:
        """Get error metrics for dashboard."""
        error_stats = metrics_summary.get("error_statistics", {})
        
        return {
            "total_errors": error_stats.get("total_errors", 0),
            "error_rate": error_stats.get("error_rate", 0),
            "error_types": error_stats.get("error_types", {}),
            "top_error": max(error_stats.get("error_types", {}).keys(), 
                           key=lambda k: error_stats["error_types"][k]) if error_stats.get("error_types") else None
        }
    
    def _get_system_metrics(self) -> Dict[str, Any]:
        """Get system metrics for dashboard."""
        return {
            "memory_usage_mb": self._get_memory_usage(),
            "cpu_usage_percent": self._get_cpu_usage(),
            "disk_usage_percent": self._get_disk_usage(),
            "active_connections": self._get_active_connections()
        }
    
    def _get_active_alerts(self, metrics_summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get active alerts for dashboard."""
        alerts = []
        
        # Check for high error rate
        error_rate = metrics_summary.get("error_statistics", {}).get("error_rate", 0)
        if error_rate > 5:
            alerts.append({
                "level": "warning",
                "message": f"High error rate: {error_rate:.1f}%",
                "timestamp": time.time()
            })
        
        # Check for slow response times
        avg_response_time = metrics_summary.get("response_times", {}).get("average_ms", 0)
        if avg_response_time > 10000:
            alerts.append({
                "level": "warning",
                "message": f"Slow response times: {avg_response_time:.0f}ms average",
                "timestamp": time.time()
            })
        
        # Check for low success rate
        success_rate = metrics_summary.get("success_rates", {}).get("last_hour", 0)
        if success_rate < 95:
            alerts.append({
                "level": "critical",
                "message": f"Low success rate: {success_rate:.1f}%",
                "timestamp": time.time()
            })
        
        return alerts
    
    def _get_chart_data(self) -> Dict[str, Any]:
        """Get data for dashboard charts."""
        # Get time series data for charts
        response_time_data = metrics_collector.get_time_series("request_duration_ms", hours=1)
        request_count_data = metrics_collector.get_time_series("requests_total", hours=1)
        
        return {
            "response_time_chart": self._format_chart_data(response_time_data, "Response Time (ms)"),
            "request_count_chart": self._format_chart_data(request_count_data, "Request Count"),
            "success_rate_chart": self._calculate_success_rate_chart()
        }
    
    def _format_chart_data(self, time_series: List[Dict[str, Any]], label: str) -> Dict[str, Any]:
        """Format time series data for charts."""
        if not time_series:
            return {"labels": [], "data": [], "label": label}
        
        # Sort by timestamp
        sorted_data = sorted(time_series, key=lambda x: x["timestamp"])
        
        # Format for chart
        labels = [datetime.fromtimestamp(point["timestamp"]).strftime("%H:%M") for point in sorted_data]
        data = [point["value"] for point in sorted_data]
        
        return {
            "labels": labels,
            "data": data,
            "label": label
        }
    
    def _calculate_success_rate_chart(self) -> Dict[str, Any]:
        """Calculate success rate chart data."""
        # Get request history for last hour
        requests = metrics_collector.get_request_history(hours=1, limit=1000)
        
        if not requests:
            return {"labels": [], "data": [], "label": "Success Rate (%)"}
        
        # Group requests by 5-minute intervals
        intervals = {}
        for req in requests:
            # Round timestamp to 5-minute intervals
            interval_time = int(req["timestamp"] // 300) * 300
            if interval_time not in intervals:
                intervals[interval_time] = {"total": 0, "successful": 0}
            
            intervals[interval_time]["total"] += 1
            if req["success"]:
                intervals[interval_time]["successful"] += 1
        
        # Calculate success rates
        labels = []
        data = []
        for interval_time in sorted(intervals.keys()):
            interval_data = intervals[interval_time]
            success_rate = (interval_data["successful"] / interval_data["total"]) * 100
            
            labels.append(datetime.fromtimestamp(interval_time).strftime("%H:%M"))
            data.append(round(success_rate, 1))
        
        return {
            "labels": labels,
            "data": data,
            "label": "Success Rate (%)"
        }
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB."""
        try:
            import psutil
            import os
            process = psutil.Process(os.getpid())
            return round(process.memory_info().rss / 1024 / 1024, 1)
        except ImportError:
            return 0.0
    
    def _get_cpu_usage(self) -> float:
        """Get current CPU usage percentage."""
        try:
            import psutil
            return round(psutil.cpu_percent(interval=0.1), 1)
        except ImportError:
            return 0.0
    
    def _get_disk_usage(self) -> float:
        """Get current disk usage percentage."""
        try:
            import psutil
            return round(psutil.disk_usage('/').percent, 1)
        except ImportError:
            return 0.0
    
    def _get_active_connections(self) -> int:
        """Get number of active connections."""
        # This is a placeholder - in a real implementation,
        # you would track active connections
        return 0
    
    def _calculate_trend(self, time_series: List[Dict[str, Any]]) -> str:
        """Calculate trend direction from time series data."""
        if len(time_series) < 2:
            return "stable"
        
        # Simple trend calculation based on first and last values
        first_value = time_series[0]["value"]
        last_value = time_series[-1]["value"]
        
        if last_value > first_value * 1.1:
            return "increasing"
        elif last_value < first_value * 0.9:
            return "decreasing"
        else:
            return "stable"
    
    def _identify_peak_hours(self, request_series: List[Dict[str, Any]]) -> List[int]:
        """Identify peak usage hours."""
        # Group requests by hour
        hourly_counts = {}
        for point in request_series:
            hour = datetime.fromtimestamp(point["timestamp"]).hour
            hourly_counts[hour] = hourly_counts.get(hour, 0) + point["value"]
        
        # Find top 3 peak hours
        sorted_hours = sorted(hourly_counts.items(), key=lambda x: x[1], reverse=True)
        return [hour for hour, count in sorted_hours[:3]]
    
    def _summarize_performance_trends(self, hours: int) -> Dict[str, Any]:
        """Summarize performance trends."""
        # This is a simplified implementation
        return {
            "overall_trend": "stable",
            "performance_score": 85,  # Out of 100
            "key_insights": [
                "Response times are within acceptable range",
                "Success rate is above target threshold",
                "No significant performance degradation detected"
            ]
        }
    
    def _generate_executive_summary(self, metrics_summary: Dict[str, Any], request_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate executive summary for reports."""
        total_requests = len(request_history)
        successful_requests = sum(1 for req in request_history if req["success"])
        success_rate = (successful_requests / total_requests * 100) if total_requests > 0 else 0
        
        avg_response_time = sum(req["response_time_ms"] for req in request_history) / total_requests if total_requests > 0 else 0
        
        return {
            "total_requests": total_requests,
            "success_rate": round(success_rate, 2),
            "average_response_time_ms": round(avg_response_time, 2),
            "key_highlights": [
                f"Processed {total_requests} requests",
                f"Achieved {success_rate:.1f}% success rate",
                f"Average response time: {avg_response_time:.0f}ms"
            ]
        }
    
    def _analyze_performance(self, request_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze performance from request history."""
        if not request_history:
            return {"message": "No requests to analyze"}
        
        response_times = [req["response_time_ms"] for req in request_history]
        
        return {
            "response_time_analysis": {
                "min_ms": min(response_times),
                "max_ms": max(response_times),
                "avg_ms": sum(response_times) / len(response_times),
                "median_ms": sorted(response_times)[len(response_times) // 2]
            },
            "performance_grade": self._calculate_performance_grade(response_times)
        }
    
    def _analyze_usage_patterns(self, request_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze usage patterns from request history."""
        if not request_history:
            return {"message": "No requests to analyze"}
        
        # Analyze by hour
        hourly_usage = {}
        for req in request_history:
            hour = datetime.fromtimestamp(req["timestamp"]).hour
            hourly_usage[hour] = hourly_usage.get(hour, 0) + 1
        
        # Analyze by endpoint
        endpoint_usage = {}
        for req in request_history:
            endpoint = req.get("endpoint", "unknown")
            endpoint_usage[endpoint] = endpoint_usage.get(endpoint, 0) + 1
        
        return {
            "hourly_distribution": hourly_usage,
            "endpoint_distribution": endpoint_usage,
            "peak_hour": max(hourly_usage.keys(), key=lambda k: hourly_usage[k]) if hourly_usage else None,
            "most_used_endpoint": max(endpoint_usage.keys(), key=lambda k: endpoint_usage[k]) if endpoint_usage else None
        }
    
    def _analyze_errors(self, request_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze errors from request history."""
        errors = [req for req in request_history if not req["success"]]
        
        if not errors:
            return {"message": "No errors to analyze", "error_count": 0}
        
        # Group by error type
        error_types = {}
        for error in errors:
            error_type = error.get("error_type", "unknown")
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        return {
            "error_count": len(errors),
            "error_rate": (len(errors) / len(request_history)) * 100,
            "error_types": error_types,
            "most_common_error": max(error_types.keys(), key=lambda k: error_types[k]) if error_types else None
        }
    
    def _generate_recommendations(self, metrics_summary: Dict[str, Any], request_history: List[Dict[str, Any]]) -> List[str]:
        """Generate recommendations based on analysis."""
        recommendations = []
        
        # Check response times
        avg_response_time = metrics_summary.get("response_times", {}).get("average_ms", 0)
        if avg_response_time > 5000:
            recommendations.append("Consider optimizing model selection or upgrading hardware for better response times")
        
        # Check error rate
        error_rate = metrics_summary.get("error_statistics", {}).get("error_rate", 0)
        if error_rate > 2:
            recommendations.append("Investigate and address high error rate")
        
        # Check success rate
        success_rate = metrics_summary.get("success_rates", {}).get("last_hour", 0)
        if success_rate < 98:
            recommendations.append("Monitor service health and consider implementing additional error handling")
        
        if not recommendations:
            recommendations.append("System is performing well - continue monitoring")
        
        return recommendations
    
    def _calculate_performance_grade(self, response_times: List[float]) -> str:
        """Calculate performance grade based on response times."""
        avg_time = sum(response_times) / len(response_times)
        
        if avg_time < 1000:  # < 1 second
            return "A"
        elif avg_time < 3000:  # < 3 seconds
            return "B"
        elif avg_time < 5000:  # < 5 seconds
            return "C"
        elif avg_time < 10000:  # < 10 seconds
            return "D"
        else:
            return "F"


# Global monitoring dashboard instance
monitoring_dashboard = MonitoringDashboard()