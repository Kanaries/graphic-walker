import os
import time
import uuid
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ollama integration
from ollama_service import ollama_service
from logging_config import setup_logging, get_logger

# Monitoring integration
from metrics_collector import metrics_collector, RequestMetrics
from monitoring_dashboard import monitoring_dashboard

load_dotenv()

# Setup enhanced logging
setup_logging(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format_type=os.getenv("LOG_FORMAT", "json"),
    log_file=os.getenv("LOG_FILE")
)

logger = get_logger("fastapi_app")

# Startup event to perform initial health check
from contextlib import asynccontextmanager

async def startup_event():
    """
    Perform startup health check and log service status.
    
    Validates Ollama service availability and logs all available endpoints.
    """
    logger.info("Starting Ollama-based text2sql service")
    logger.info("Available endpoints", extra={
        "endpoints": [
            "POST /api/ollama-text2sql",
            "GET /api/health (basic health check)",
            "GET /api/health/detailed (comprehensive health check)",
            "GET /api/health/metrics (health statistics)",
            "GET /api/health/history (health check history)",
            "GET /api/service-info (service information)",
            "GET /api/models (available models)"
        ]
    })
    
    # Perform comprehensive startup validation
    try:
        startup_results = await ollama_service.perform_startup_validation()
        
        if startup_results.get("ready", False):
            logger.info(
                "Startup validation completed successfully",
                extra={
                    "overall_status": startup_results.get("overall_status"),
                    "checks_passed": sum(1 for check in startup_results.get("checks", []) 
                                       if check.get("status") == "healthy"),
                    "total_checks": len(startup_results.get("checks", [])),
                    "ready": True
                }
            )
        else:
            logger.warning(
                "Startup validation completed with issues",
                extra={
                    "overall_status": startup_results.get("overall_status"),
                    "ready": False,
                    "message": "Service may have limited functionality"
                }
            )
            
            # Log failed checks
            failed_checks = [check for check in startup_results.get("checks", []) 
                           if check.get("status") in ["unhealthy", "degraded"]]
            if failed_checks:
                logger.warning(
                    "Failed startup checks",
                    extra={"failed_checks": [check["name"] for check in failed_checks]}
                )
    
    except Exception as e:
        logger.error(
            "Startup validation failed",
            extra={"error": str(e), "fallback": "Using basic health check"}
        )
        
        # Fallback to basic health check
        is_healthy = await ollama_service.health_check()
        if is_healthy:
            logger.info("Basic health check passed - service ready with limited monitoring")
        else:
            logger.warning("Basic health check failed - service may not function properly")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await startup_event()
    yield
    # Shutdown (if needed)

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

async def _text2sql_handler(request: Request):
    """
    Handler for text-to-SQL conversion using Ollama with metrics collection.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    body = await request.json()
    prompt = body.get("prompt", "")
    model_override = body.get("model")  # Optional model override
    
    # Get client IP for logging
    client_ip = request.client.host if request.client else "unknown"
    endpoint = str(request.url.path)
    
    logger.info(
        "Received text2sql request",
        extra={
            "request_id": request_id,
            "client_ip": client_ip,
            "prompt_length": len(prompt),
            "model_override": model_override,
            "endpoint": endpoint
        }
    )
    
    # Generate SQL using Ollama service
    result = await ollama_service.generate_sql(prompt, model_override)
    
    # Calculate response time
    response_time_ms = (time.time() - start_time) * 1000
    
    # Determine success and error type
    success = "sql" in result
    error_type = None
    status_code = 200
    
    if not success:
        error_type = result.get("error", "unknown_error")
        # Map error types to HTTP status codes if needed
        if "timeout" in error_type.lower():
            status_code = 408
        elif "unavailable" in error_type.lower():
            status_code = 503
        elif "invalid" in error_type.lower():
            status_code = 400
    
    # Record metrics
    request_metrics = RequestMetrics(
        request_id=request_id,
        endpoint=endpoint,
        method="POST",
        status_code=status_code,
        response_time_ms=response_time_ms,
        prompt_length=len(prompt),
        sql_length=len(result.get("sql", "")),
        model_used=model_override or "default",
        success=success,
        error_type=error_type,
        timestamp=start_time,
        client_ip=client_ip
    )
    
    metrics_collector.record_request(request_metrics)
    
    # Log response summary
    if success:
        logger.info(
            "Text2sql request completed successfully",
            extra={
                "request_id": request_id,
                "client_ip": client_ip,
                "sql_length": len(result["sql"]),
                "response_time_ms": response_time_ms,
                "success": True
            }
        )
    else:
        logger.warning(
            "Text2sql request failed",
            extra={
                "request_id": request_id,
                "client_ip": client_ip,
                "error": result.get("error", "unknown"),
                "error_type": error_type,
                "response_time_ms": response_time_ms,
                "success": False
            }
        )
    
    return result

@app.post("/api/ollama-text2sql")
async def ollama_text2sql(request: Request):
    """
    Generate SQL from natural language prompt using Ollama.
    
    This is the primary endpoint for text-to-SQL conversion using the local Ollama LLM service.
    Accepts a natural language prompt and returns generated SQL code.
    
    Request body:
        - prompt (str): Natural language description of desired SQL query
        - model (str, optional): Override default Ollama model
    
    Returns:
        Dict with 'sql' key containing generated SQL, or 'error' key if generation fails
    """
    return await _text2sql_handler(request)
@app.get("/api/health")
async def health_check(request: Request):
    """Basic health check endpoint."""
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info("Health check requested", extra={"client_ip": client_ip})
    
    is_healthy = await ollama_service.health_check()
    
    if is_healthy:
        logger.info("Health check passed", extra={"client_ip": client_ip, "status": "healthy"})
        return {"status": "healthy", "service": "ollama", "timestamp": time.time()}
    else:
        logger.warning("Health check failed", extra={"client_ip": client_ip, "status": "unhealthy"})
        return {"status": "unhealthy", "service": "ollama", "error": "Ollama service unavailable", "timestamp": time.time()}

@app.get("/api/health/detailed")
async def detailed_health_check(request: Request):
    """Comprehensive health check with detailed information."""
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info("Detailed health check requested", extra={"client_ip": client_ip})
    
    try:
        health_info = await ollama_service.get_detailed_health()
        
        logger.info(
            "Detailed health check completed",
            extra={
                "client_ip": client_ip,
                "status": health_info.get("status", "unknown"),
                "checks_count": len(health_info.get("checks", []))
            }
        )
        
        return health_info
    except Exception as e:
        logger.error(f"Detailed health check failed: {str(e)}", extra={"client_ip": client_ip})
        return {
            "status": "error",
            "message": "Health check failed",
            "error": str(e),
            "timestamp": time.time()
        }

@app.get("/api/health/metrics")
async def health_metrics(request: Request):
    """Get health metrics and statistics."""
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info("Health metrics requested", extra={"client_ip": client_ip})
    
    try:
        metrics = ollama_service.get_health_metrics()
        return metrics
    except Exception as e:
        logger.error(f"Health metrics request failed: {str(e)}", extra={"client_ip": client_ip})
        return {
            "error": "Failed to get health metrics",
            "details": str(e),
            "timestamp": time.time()
        }

@app.get("/api/health/history")
async def health_history(request: Request, limit: int = 10):
    """Get recent health check history."""
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info("Health history requested", extra={"client_ip": client_ip, "limit": limit})
    
    try:
        history = ollama_service.get_health_history(limit)
        return {
            "history": history,
            "count": len(history),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Health history request failed: {str(e)}", extra={"client_ip": client_ip})
        return {
            "error": "Failed to get health history",
            "details": str(e),
            "timestamp": time.time()
        }

@app.get("/api/service-info")
async def get_service_info():
    """Get comprehensive service information for debugging and monitoring."""
    return ollama_service.get_service_info()

@app.get("/api/models")
async def get_available_models():
    """Get list of available models from Ollama server."""
    return ollama_service.get_available_models()

@app.post("/api/ollama-text2sql/detailed")
async def ollama_text2sql_detailed(request: Request):
    """
    Generate SQL with detailed processing information.
    Returns comprehensive details about the generation and processing steps.
    """
    body = await request.json()
    prompt = body.get("prompt", "")
    model_override = body.get("model")
    
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info(
        "Received detailed text2sql request",
        extra={
            "client_ip": client_ip,
            "prompt_length": len(prompt),
            "model_override": model_override,
            "endpoint": "detailed"
        }
    )
    
    result = await ollama_service.generate_sql_with_processing_details(prompt, model_override)
    
    # Log response summary
    if "sql" in result:
        logger.info(
            "Detailed text2sql request completed successfully",
            extra={
                "client_ip": client_ip,
                "request_id": result.get("request_id"),
                "sql_valid": result.get("validation", {}).get("is_valid", False),
                "processing_warnings": len(result.get("processing", {}).get("warnings", [])),
                "success": True
            }
        )
    else:
        logger.warning(
            "Detailed text2sql request failed",
            extra={
                "client_ip": client_ip,
                "request_id": result.get("request_id"),
                "error": result.get("error", "unknown"),
                "success": False
            }
        )
    
    return result

@app.post("/api/sql/process")
async def process_sql_response(request: Request):
    """
    Process raw SQL response using the SQL processor.
    Useful for testing and debugging SQL cleaning logic.
    """
    body = await request.json()
    raw_response = body.get("response", "")
    context = body.get("context", {})
    
    client_ip = request.client.host if request.client else "unknown"
    
    logger.info(
        "SQL processing request received",
        extra={
            "client_ip": client_ip,
            "response_length": len(raw_response),
            "has_context": bool(context)
        }
    )
    
    result = ollama_service.process_sql_response(raw_response, context)
    
    logger.info(
        "SQL processing completed",
        extra={
            "client_ip": client_ip,
            "success": result.get("success", False),
            "warnings_count": len(result.get("processing", {}).get("warnings", [])),
            "validation_errors": len(result.get("validation", {}).get("errors", []))
        }
    )
    
    return result



@app.get("/api/monitoring/dashboard")
async def get_monitoring_dashboard():
    """Get comprehensive monitoring dashboard data."""
    return monitoring_dashboard.get_dashboard_data()

@app.get("/api/monitoring/real-time")
async def get_real_time_metrics():
    """Get real-time metrics for live dashboard updates."""
    return monitoring_dashboard.get_real_time_metrics()

@app.get("/api/monitoring/health-status")
async def get_health_status():
    """Get overall health status for monitoring systems."""
    return monitoring_dashboard.get_health_status()

@app.get("/api/monitoring/performance-trends")
async def get_performance_trends(hours: int = 24):
    """Get performance trends over specified time period."""
    return monitoring_dashboard.get_performance_trends(hours)

@app.get("/api/monitoring/report/{report_type}")
async def generate_monitoring_report(report_type: str):
    """Generate comprehensive monitoring report."""
    if report_type not in ["hourly", "daily", "weekly"]:
        return {"error": "Invalid report type. Use: hourly, daily, or weekly"}
    
    return monitoring_dashboard.generate_report(report_type)

@app.get("/api/metrics/summary")
async def get_metrics_summary():
    """Get comprehensive metrics summary."""
    return metrics_collector.get_metrics_summary()

@app.get("/api/metrics/export")
async def export_metrics(format: str = "json"):
    """Export metrics in various formats."""
    try:
        exported_data = metrics_collector.export_metrics(format)
        
        if format == "prometheus":
            return Response(content=exported_data, media_type="text/plain")
        else:
            return Response(content=exported_data, media_type="application/json")
    except ValueError as e:
        return {"error": str(e)}

@app.get("/api/metrics/time-series/{metric_name}")
async def get_metric_time_series(metric_name: str, hours: int = 1):
    """Get time series data for a specific metric."""
    return {
        "metric_name": metric_name,
        "hours": hours,
        "data": metrics_collector.get_time_series(metric_name, hours)
    }

@app.get("/api/metrics/requests")
async def get_request_metrics(hours: int = 1, limit: int = 100):
    """Get recent request history with metrics."""
    return {
        "hours": hours,
        "limit": limit,
        "requests": metrics_collector.get_request_history(hours, limit)
    }

# To run: uvicorn app:app --reload --port 3002
