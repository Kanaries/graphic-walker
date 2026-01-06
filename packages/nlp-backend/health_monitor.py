import asyncio
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from logging_config import get_logger, log_error, ErrorTypes

logger = get_logger("health_monitor")

class HealthStatus(Enum):
    """Health status enumeration."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class HealthCheckResult:
    """Result of a health check operation."""
    name: str
    status: HealthStatus
    message: str
    duration_ms: float
    timestamp: float
    details: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = asdict(self)
        result['status'] = self.status.value
        return result

class HealthMonitor:
    """
    Comprehensive health monitoring system for Ollama service.
    Provides startup validation, periodic health checks, and detailed status reporting.
    """
    
    def __init__(self, ollama_service):
        """
        Initialize health monitor.
        
        Args:
            ollama_service: OllamaService instance to monitor
        """
        self.ollama_service = ollama_service
        self.startup_completed = False
        self.last_health_check = None
        self.health_history: List[HealthCheckResult] = []
        self.max_history_size = 50
        
    async def perform_startup_validation(self) -> Dict[str, Any]:
        """
        Perform comprehensive startup validation.
        
        Returns:
            Dict containing startup validation results
        """
        logger.info("Starting comprehensive startup validation")
        
        validation_results = {
            "startup_time": time.time(),
            "checks": [],
            "overall_status": HealthStatus.UNKNOWN.value,
            "ready": False
        }
        
        # 1. Configuration validation
        config_result = await self._check_configuration()
        validation_results["checks"].append(config_result.to_dict())
        
        # 2. Ollama client initialization
        client_result = await self._check_client_initialization()
        validation_results["checks"].append(client_result.to_dict())
        
        # 3. Ollama server connectivity
        connectivity_result = await self._check_ollama_connectivity()
        validation_results["checks"].append(connectivity_result.to_dict())
        
        # 4. Model availability
        models_result = await self._check_model_availability()
        validation_results["checks"].append(models_result.to_dict())
        
        # 5. Basic functionality test
        functionality_result = await self._check_basic_functionality()
        validation_results["checks"].append(functionality_result.to_dict())
        
        # Determine overall status
        overall_status = self._determine_overall_status(validation_results["checks"])
        validation_results["overall_status"] = overall_status.value
        validation_results["ready"] = overall_status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED]
        
        self.startup_completed = True
        
        logger.info(
            "Startup validation completed",
            extra={
                "overall_status": overall_status.value,
                "ready": validation_results["ready"],
                "checks_passed": sum(1 for check in validation_results["checks"] 
                                   if check["status"] == HealthStatus.HEALTHY.value),
                "total_checks": len(validation_results["checks"])
            }
        )
        
        return validation_results
    
    async def perform_health_check(self, include_detailed: bool = False) -> Dict[str, Any]:
        """
        Perform comprehensive health check.
        
        Args:
            include_detailed: Whether to include detailed check results
            
        Returns:
            Dict containing health check results
        """
        start_time = time.time()
        
        health_result = {
            "timestamp": start_time,
            "status": HealthStatus.UNKNOWN.value,
            "checks": [],
            "summary": {},
            "uptime_seconds": start_time - (self.health_history[0].timestamp if self.health_history else start_time)
        }
        
        # Perform health checks
        checks = [
            self._check_ollama_connectivity(),
            self._check_model_availability(),
        ]
        
        if include_detailed:
            checks.extend([
                self._check_response_times(),
                self._check_resource_usage()
            ])
        
        # Execute all checks concurrently
        check_results = await asyncio.gather(*checks, return_exceptions=True)
        
        # Process results
        for result in check_results:
            if isinstance(result, Exception):
                error_result = HealthCheckResult(
                    name="unknown_check",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check failed: {str(result)}",
                    duration_ms=0,
                    timestamp=time.time()
                )
                health_result["checks"].append(error_result.to_dict())
            else:
                health_result["checks"].append(result.to_dict())
        
        # Determine overall status
        overall_status = self._determine_overall_status(health_result["checks"])
        health_result["status"] = overall_status.value
        
        # Create summary
        health_result["summary"] = self._create_health_summary(health_result["checks"])
        
        # Store in history
        overall_result = HealthCheckResult(
            name="overall_health",
            status=overall_status,
            message=f"Overall health: {overall_status.value}",
            duration_ms=(time.time() - start_time) * 1000,
            timestamp=start_time,
            details=health_result["summary"]
        )
        
        self._add_to_history(overall_result)
        self.last_health_check = overall_result
        
        return health_result
    
    async def _check_configuration(self) -> HealthCheckResult:
        """Check configuration validity."""
        start_time = time.time()
        
        try:
            from config import get_config_summary
            config = get_config_summary()
            
            # Validate required configuration
            required_fields = ["ollama_base_url", "ollama_model", "ollama_timeout"]
            missing_fields = [field for field in required_fields if not config.get(field)]
            
            if missing_fields:
                return HealthCheckResult(
                    name="configuration",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Missing required configuration: {', '.join(missing_fields)}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time,
                    details={"missing_fields": missing_fields}
                )
            
            return HealthCheckResult(
                name="configuration",
                status=HealthStatus.HEALTHY,
                message="Configuration is valid",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time,
                details=config
            )
            
        except Exception as e:
            return HealthCheckResult(
                name="configuration",
                status=HealthStatus.UNHEALTHY,
                message=f"Configuration check failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    async def _check_client_initialization(self) -> HealthCheckResult:
        """Check if Ollama client is properly initialized."""
        start_time = time.time()
        
        if not self.ollama_service.client:
            return HealthCheckResult(
                name="client_initialization",
                status=HealthStatus.UNHEALTHY,
                message="Ollama client not initialized",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
        
        return HealthCheckResult(
            name="client_initialization",
            status=HealthStatus.HEALTHY,
            message="Ollama client initialized successfully",
            duration_ms=(time.time() - start_time) * 1000,
            timestamp=start_time
        )
    
    async def _check_ollama_connectivity(self) -> HealthCheckResult:
        """Check connectivity to Ollama server."""
        start_time = time.time()
        
        try:
            is_healthy = await self.ollama_service.health_check()
            
            if is_healthy:
                return HealthCheckResult(
                    name="ollama_connectivity",
                    status=HealthStatus.HEALTHY,
                    message="Ollama server is reachable and responsive",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time
                )
            else:
                return HealthCheckResult(
                    name="ollama_connectivity",
                    status=HealthStatus.UNHEALTHY,
                    message="Ollama server is not responding",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time
                )
                
        except Exception as e:
            return HealthCheckResult(
                name="ollama_connectivity",
                status=HealthStatus.UNHEALTHY,
                message=f"Connectivity check failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    async def _check_model_availability(self) -> HealthCheckResult:
        """Check if required models are available."""
        start_time = time.time()
        
        try:
            models_info = self.ollama_service.get_available_models()
            
            if "error" in models_info:
                return HealthCheckResult(
                    name="model_availability",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Failed to get models: {models_info['error']}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time
                )
            
            available_models = models_info.get("available_models", [])
            recommended_models = models_info.get("recommended_models", [])
            
            if not available_models:
                return HealthCheckResult(
                    name="model_availability",
                    status=HealthStatus.UNHEALTHY,
                    message="No models available on Ollama server",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time
                )
            
            # Check if at least one recommended model is available
            if not recommended_models:
                return HealthCheckResult(
                    name="model_availability",
                    status=HealthStatus.DEGRADED,
                    message=f"Models available but none recommended for SQL tasks. Available: {len(available_models)}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time,
                    details={
                        "available_count": len(available_models),
                        "recommended_count": len(recommended_models),
                        "available_models": available_models[:5]  # First 5 for brevity
                    }
                )
            
            return HealthCheckResult(
                name="model_availability",
                status=HealthStatus.HEALTHY,
                message=f"Models available: {len(available_models)}, recommended: {len(recommended_models)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time,
                details={
                    "available_count": len(available_models),
                    "recommended_count": len(recommended_models),
                    "recommended_models": recommended_models
                }
            )
            
        except Exception as e:
            return HealthCheckResult(
                name="model_availability",
                status=HealthStatus.UNHEALTHY,
                message=f"Model availability check failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    async def _check_basic_functionality(self) -> HealthCheckResult:
        """Test basic SQL generation functionality."""
        start_time = time.time()
        
        try:
            # Simple test prompt
            test_prompt = "SELECT 1"
            result = await self.ollama_service.generate_sql(test_prompt)
            
            if "error" in result:
                return HealthCheckResult(
                    name="basic_functionality",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Basic functionality test failed: {result['error']}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time,
                    details={"test_prompt": test_prompt, "error": result.get("details")}
                )
            
            if "sql" in result and result["sql"].strip():
                return HealthCheckResult(
                    name="basic_functionality",
                    status=HealthStatus.HEALTHY,
                    message="Basic SQL generation is working",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time,
                    details={"test_prompt": test_prompt, "generated_sql": result["sql"][:50]}
                )
            else:
                return HealthCheckResult(
                    name="basic_functionality",
                    status=HealthStatus.DEGRADED,
                    message="SQL generation returned empty result",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time,
                    details={"test_prompt": test_prompt}
                )
                
        except Exception as e:
            return HealthCheckResult(
                name="basic_functionality",
                status=HealthStatus.UNHEALTHY,
                message=f"Functionality test failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    async def _check_response_times(self) -> HealthCheckResult:
        """Check response time performance."""
        start_time = time.time()
        
        try:
            # Test with a simple prompt and measure response time
            test_start = time.time()
            result = await self.ollama_service.generate_sql("SELECT current_timestamp")
            response_time = (time.time() - test_start) * 1000  # Convert to ms
            
            if "error" in result:
                return HealthCheckResult(
                    name="response_times",
                    status=HealthStatus.DEGRADED,
                    message=f"Response time check failed: {result['error']}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=start_time
                )
            
            # Categorize response times
            if response_time < 1000:  # < 1 second
                status = HealthStatus.HEALTHY
                message = f"Response time excellent: {response_time:.0f}ms"
            elif response_time < 5000:  # < 5 seconds
                status = HealthStatus.HEALTHY
                message = f"Response time good: {response_time:.0f}ms"
            elif response_time < 15000:  # < 15 seconds
                status = HealthStatus.DEGRADED
                message = f"Response time slow: {response_time:.0f}ms"
            else:
                status = HealthStatus.UNHEALTHY
                message = f"Response time too slow: {response_time:.0f}ms"
            
            return HealthCheckResult(
                name="response_times",
                status=status,
                message=message,
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time,
                details={"response_time_ms": response_time}
            )
            
        except Exception as e:
            return HealthCheckResult(
                name="response_times",
                status=HealthStatus.UNHEALTHY,
                message=f"Response time check failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    async def _check_resource_usage(self) -> HealthCheckResult:
        """Check basic resource usage (if available)."""
        start_time = time.time()
        
        try:
            import psutil
            
            # Get basic system metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            
            details = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": memory.available / (1024**3)
            }
            
            # Simple thresholds
            if cpu_percent > 90 or memory.percent > 90:
                status = HealthStatus.DEGRADED
                message = f"High resource usage - CPU: {cpu_percent:.1f}%, Memory: {memory.percent:.1f}%"
            elif cpu_percent > 70 or memory.percent > 70:
                status = HealthStatus.DEGRADED
                message = f"Moderate resource usage - CPU: {cpu_percent:.1f}%, Memory: {memory.percent:.1f}%"
            else:
                status = HealthStatus.HEALTHY
                message = f"Resource usage normal - CPU: {cpu_percent:.1f}%, Memory: {memory.percent:.1f}%"
            
            return HealthCheckResult(
                name="resource_usage",
                status=status,
                message=message,
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time,
                details=details
            )
            
        except ImportError:
            return HealthCheckResult(
                name="resource_usage",
                status=HealthStatus.UNKNOWN,
                message="Resource monitoring not available (psutil not installed)",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
        except Exception as e:
            return HealthCheckResult(
                name="resource_usage",
                status=HealthStatus.UNKNOWN,
                message=f"Resource check failed: {str(e)}",
                duration_ms=(time.time() - start_time) * 1000,
                timestamp=start_time
            )
    
    def _determine_overall_status(self, checks: List[Dict[str, Any]]) -> HealthStatus:
        """Determine overall status from individual check results."""
        if not checks:
            return HealthStatus.UNKNOWN
        
        statuses = [HealthStatus(check["status"]) for check in checks]
        
        # If any check is unhealthy, overall is unhealthy
        if HealthStatus.UNHEALTHY in statuses:
            return HealthStatus.UNHEALTHY
        
        # If any check is degraded, overall is degraded
        if HealthStatus.DEGRADED in statuses:
            return HealthStatus.DEGRADED
        
        # If all checks are healthy, overall is healthy
        if all(status == HealthStatus.HEALTHY for status in statuses):
            return HealthStatus.HEALTHY
        
        # If we have unknown statuses but no unhealthy/degraded, it's degraded
        return HealthStatus.DEGRADED
    
    def _create_health_summary(self, checks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a summary of health check results."""
        status_counts = {}
        total_duration = 0
        
        for check in checks:
            status = check["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
            total_duration += check.get("duration_ms", 0)
        
        return {
            "total_checks": len(checks),
            "status_counts": status_counts,
            "total_duration_ms": total_duration,
            "average_duration_ms": total_duration / len(checks) if checks else 0
        }
    
    def _add_to_history(self, result: HealthCheckResult):
        """Add result to health history."""
        self.health_history.append(result)
        
        # Keep only recent history
        if len(self.health_history) > self.max_history_size:
            self.health_history = self.health_history[-self.max_history_size:]
    
    def get_health_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent health check history."""
        recent_history = self.health_history[-limit:] if self.health_history else []
        return [result.to_dict() for result in recent_history]
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get health metrics and statistics."""
        if not self.health_history:
            return {"message": "No health history available"}
        
        recent_checks = self.health_history[-10:]  # Last 10 checks
        
        # Calculate success rate
        healthy_count = sum(1 for check in recent_checks 
                          if check.status == HealthStatus.HEALTHY)
        success_rate = (healthy_count / len(recent_checks)) * 100
        
        # Calculate average response time
        avg_duration = sum(check.duration_ms for check in recent_checks) / len(recent_checks)
        
        # Get current status
        current_status = self.last_health_check.status.value if self.last_health_check else "unknown"
        
        return {
            "current_status": current_status,
            "success_rate_percent": round(success_rate, 1),
            "average_response_time_ms": round(avg_duration, 1),
            "total_checks_performed": len(self.health_history),
            "startup_completed": self.startup_completed,
            "last_check_timestamp": self.last_health_check.timestamp if self.last_health_check else None
        }