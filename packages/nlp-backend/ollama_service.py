import time
import uuid
from typing import Dict, Any, Optional, List
from fastapi import HTTPException
from ollama_client import OllamaClient
from config import get_config_summary
from logging_config import get_logger, log_error, ErrorTypes

logger = get_logger("ollama_service")

class OllamaService:
    """
    Service layer for Ollama integration with FastAPI.
    
    Provides text-to-SQL conversion using local Ollama LLM models. This service manages
    the Ollama client connection, health monitoring, and request processing with comprehensive
    error handling and logging.
    """
    
    def __init__(self):
        """
        Initialize Ollama service with client and health checking.
        
        Sets up the Ollama client connection and health monitoring system.
        """
        self.client = None
        self.is_healthy = False
        self.health_monitor = None
        self._initialize_client()
        self._initialize_health_monitor()
    
    def _initialize_client(self) -> None:
        """
        Initialize Ollama client and perform initial setup.
        
        Creates the OllamaClient instance and logs configuration details.
        """
        try:
            self.client = OllamaClient()
            config = get_config_summary()
            logger.info(
                "Ollama client initialized successfully",
                extra={"configuration": config}
            )
        except Exception as e:
            log_error(
                logger, e, ErrorTypes.CONFIGURATION_ERROR,
                operation="initialize_client"
            )
            self.client = None
    
    def _initialize_health_monitor(self) -> None:
        """Initialize health monitoring system."""
        try:
            from health_monitor import HealthMonitor
            self.health_monitor = HealthMonitor(self)
            logger.info("Health monitor initialized successfully")
        except Exception as e:
            log_error(
                logger, e, ErrorTypes.CONFIGURATION_ERROR,
                operation="initialize_health_monitor"
            )
            self.health_monitor = None
    
    async def health_check(self) -> bool:
        """
        Perform basic health check on Ollama service.
        
        Verifies that the Ollama client is initialized and the Ollama server is responding.
        
        Returns:
            bool: True if service is healthy and ready to process requests, False otherwise
        """
        if not self.client:
            logger.warning("Ollama client not initialized")
            return False
        
        try:
            self.is_healthy = await self.client.health_check()
            return self.is_healthy
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            self.is_healthy = False
            return False
    
    async def generate_sql(self, prompt: str, model_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate SQL from natural language prompt using Ollama.
        
        Processes a natural language prompt and generates corresponding SQL code using
        the local Ollama LLM service. Includes comprehensive error handling, logging,
        and validation.
        
        Args:
            prompt: Natural language description of desired SQL query
            model_override: Optional model name to use instead of the configured default
            
        Returns:
            Dict containing either:
                - 'sql' key with generated SQL string on success
                - 'error' and 'details' keys with error information on failure
        """
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # Create context logger for this request
        request_logger = get_logger("ollama_service.request", request_id=request_id)
        
        if not self.client:
            log_error(
                request_logger, Exception("Client not initialized"), ErrorTypes.CONFIGURATION_ERROR,
                operation="generate_sql", request_id=request_id
            )
            return {"error": "Local LLM service unavailable", "details": "Ollama client initialization failed"}
        
        if not prompt or not prompt.strip():
            request_logger.warning(
                "Empty prompt provided",
                extra={"request_id": request_id, "prompt_length": len(prompt) if prompt else 0}
            )
            return {"error": "Invalid request", "details": "Prompt cannot be empty"}
        
        try:
            request_logger.info(
                "Processing SQL generation request",
                extra={
                    "request_id": request_id,
                    "prompt_length": len(prompt),
                    "model_override": model_override,
                    "prompt_preview": prompt[:100] + "..." if len(prompt) > 100 else prompt
                }
            )
            
            # Generate SQL using Ollama client
            sql = await self.client.generate_sql(prompt.strip(), model_override)
            
            if not sql or not sql.strip():
                request_logger.warning(
                    "Generated SQL is empty",
                    extra={"request_id": request_id, "sql_length": len(sql) if sql else 0}
                )
                return {"error": "Invalid model response", "details": "Generated SQL is empty"}
            
            response_time = time.time() - start_time
            request_logger.info(
                "SQL generation completed successfully",
                extra={
                    "request_id": request_id,
                    "response_time": round(response_time, 3),
                    "sql_length": len(sql),
                    "sql_preview": sql[:100] + "..." if len(sql) > 100 else sql
                }
            )
            
            return {"sql": sql}
            
        except Exception as e:
            response_time = time.time() - start_time
            
            # Categorize error types for better user experience and logging
            error_type = self._categorize_error(e)
            
            log_error(
                request_logger, e, error_type,
                operation="generate_sql",
                request_id=request_id,
                response_time=round(response_time, 3),
                prompt_length=len(prompt),
                model_override=model_override
            )
            
            return self._format_error_response(e, error_type)
    
    def get_service_info(self) -> Dict[str, Any]:
        """
        Get comprehensive service information for debugging and monitoring.
        
        Returns:
            Dict containing service status and configuration info
        """
        if not self.client:
            return {
                "status": "unavailable",
                "client_initialized": False,
                "is_healthy": False,
                "error": "Ollama client not initialized"
            }
        
        try:
            model_info = self.client.get_model_info()
            return {
                "status": "available" if self.is_healthy else "unhealthy",
                "client_initialized": True,
                "is_healthy": self.is_healthy,
                "configuration": get_config_summary(),
                "model_info": model_info
            }
        except Exception as e:
            return {
                "status": "error",
                "client_initialized": True,
                "is_healthy": False,
                "error": str(e)
            }
    
    def get_available_models(self) -> Dict[str, Any]:
        """
        Get list of available models from Ollama server.
        
        Returns:
            Dict containing available models or error information
        """
        if not self.client:
            return {"error": "Local LLM service unavailable", "details": "Ollama client not initialized"}
        
        try:
            models = self.client.get_available_models()
            recommended = self.client.get_recommended_models()
            
            return {
                "available_models": models,
                "recommended_models": recommended,
                "total_available": len(models),
                "total_recommended": len(recommended)
            }
        except Exception as e:
            logger.error(f"Failed to get available models: {str(e)}")
            return {"error": "Failed to retrieve models", "details": str(e)}
    
    def _categorize_error(self, error: Exception) -> str:
        """
        Categorize error for consistent handling and logging.
        
        Args:
            error: Exception that occurred
            
        Returns:
            Error type string from ErrorTypes
        """
        error_str = str(error).lower()
        
        if "timeout" in error_str:
            return ErrorTypes.TIMEOUT_ERROR
        elif "connection" in error_str or "unavailable" in error_str:
            return ErrorTypes.CONNECTION_ERROR
        elif "model" in error_str and ("not" in error_str or "available" in error_str):
            return ErrorTypes.MODEL_ERROR
        elif "validation" in error_str or "invalid" in error_str:
            return ErrorTypes.VALIDATION_ERROR
        else:
            return ErrorTypes.UNKNOWN_ERROR
    
    def _format_error_response(self, error: Exception, error_type: str) -> Dict[str, Any]:
        """
        Format error response based on error type.
        
        Args:
            error: Exception that occurred
            error_type: Categorized error type
            
        Returns:
            Formatted error response dict
        """
        error_responses = {
            ErrorTypes.TIMEOUT_ERROR: {
                "error": "Request timeout",
                "details": "Model inference took too long"
            },
            ErrorTypes.CONNECTION_ERROR: {
                "error": "Local LLM service unavailable",
                "details": "Connection to Ollama server failed"
            },
            ErrorTypes.MODEL_ERROR: {
                "error": "Model not available",
                "details": str(error)
            },
            ErrorTypes.VALIDATION_ERROR: {
                "error": "Invalid request",
                "details": str(error)
            },
            ErrorTypes.UNKNOWN_ERROR: {
                "error": "Model inference failed",
                "details": str(error)
            }
        }
        
        return error_responses.get(error_type, {
            "error": "Unknown error occurred",
            "details": str(error)
        })
    
    async def perform_startup_validation(self) -> Dict[str, Any]:
        """
        Perform comprehensive startup validation.
        
        Returns:
            Dict containing startup validation results
        """
        if not self.health_monitor:
            return {
                "error": "Health monitor not available",
                "details": "Health monitoring system not initialized"
            }
        
        return await self.health_monitor.perform_startup_validation()
    
    async def get_detailed_health(self) -> Dict[str, Any]:
        """
        Get detailed health information including all checks.
        
        Returns:
            Dict containing comprehensive health information
        """
        if not self.health_monitor:
            return {
                "status": "unknown",
                "message": "Health monitor not available",
                "timestamp": time.time()
            }
        
        return await self.health_monitor.perform_health_check(include_detailed=True)
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """
        Get health metrics and statistics.
        
        Returns:
            Dict containing health metrics
        """
        if not self.health_monitor:
            return {
                "error": "Health monitor not available",
                "details": "Health monitoring system not initialized"
            }
        
        return self.health_monitor.get_health_metrics()
    
    def get_health_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent health check history.
        
        Args:
            limit: Maximum number of history entries to return
            
        Returns:
            List of health check results
        """
        if not self.health_monitor:
            return []
        
        return self.health_monitor.get_health_history(limit)
    
    async def generate_sql_with_processing_details(self, prompt: str, model_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate SQL with detailed processing information.
        
        Similar to generate_sql() but returns comprehensive details about the generation
        process including validation results, processing steps, and timing information.
        Useful for debugging and monitoring.
        
        Args:
            prompt: Natural language description of desired SQL query
            model_override: Optional model name to use instead of the configured default
            
        Returns:
            Dict containing SQL, validation results, processing details, and metadata
        """
        request_id = str(uuid.uuid4())[:8]
        request_logger = get_logger("ollama_service.detailed_request", request_id=request_id)
        
        if not self.client:
            return {
                "error": "Local LLM service unavailable",
                "details": "Ollama client initialization failed",
                "request_id": request_id
            }
        
        if not prompt or not prompt.strip():
            return {
                "error": "Invalid request",
                "details": "Prompt cannot be empty",
                "request_id": request_id
            }
        
        try:
            request_logger.info(
                "Processing detailed SQL generation request",
                extra={
                    "request_id": request_id,
                    "prompt_length": len(prompt),
                    "model_override": model_override
                }
            )
            
            result = await self.client.generate_sql_with_details(prompt.strip(), model_override)
            result["request_id"] = request_id
            
            request_logger.info(
                "Detailed SQL generation completed successfully",
                extra={
                    "request_id": request_id,
                    "sql_valid": result.get("validation", {}).get("is_valid", False),
                    "processing_warnings": len(result.get("processing", {}).get("warnings", [])),
                    "response_time": result.get("response_time_ms", 0)
                }
            )
            
            return result
            
        except Exception as e:
            error_type = self._categorize_error(e)
            log_error(
                request_logger, e, error_type,
                operation="generate_sql_with_details",
                request_id=request_id,
                prompt_length=len(prompt)
            )
            
            error_response = self._format_error_response(e, error_type)
            error_response["request_id"] = request_id
            return error_response
    
    def process_sql_response(self, raw_response: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process raw SQL response using the SQL processor.
        
        Cleans and validates raw SQL output from the Ollama model. Useful for testing
        and debugging the SQL processing pipeline independently.
        
        Args:
            raw_response: Raw SQL response text from Ollama to process
            context: Optional context information for processing
            
        Returns:
            Dict containing processing results, validation status, and cleaned SQL
        """
        from sql_processor import sql_processor
        
        try:
            processing_result = sql_processor.process_response(raw_response, context)
            validation_result = sql_processor.validate_sql_syntax(processing_result.cleaned)
            
            return {
                "success": True,
                "processing": processing_result.to_dict(),
                "validation": validation_result,
                "cleaned_sql": processing_result.cleaned
            }
            
        except Exception as e:
            logger.error(f"SQL processing failed: {str(e)}")
            return {
                "success": False,
                "error": "SQL processing failed",
                "details": str(e),
                "original_response": raw_response
            }


# Global service instance
ollama_service = OllamaService()