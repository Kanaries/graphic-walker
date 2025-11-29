import logging
import sys
from typing import Optional
from datetime import datetime
import json

class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging.
    """
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, 'request_id'):
            log_entry["request_id"] = record.request_id
        if hasattr(record, 'prompt_length'):
            log_entry["prompt_length"] = record.prompt_length
        if hasattr(record, 'model_used'):
            log_entry["model_used"] = record.model_used
        if hasattr(record, 'response_time'):
            log_entry["response_time"] = record.response_time
        if hasattr(record, 'error_type'):
            log_entry["error_type"] = record.error_type
        
        return json.dumps(log_entry)

class OllamaLoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter that adds context information to log records.
    """
    
    def process(self, msg, kwargs):
        # Add context from the adapter's extra dict
        if self.extra:
            for key, value in self.extra.items():
                kwargs.setdefault('extra', {})[key] = value
        return msg, kwargs

def setup_logging(
    level: str = "INFO",
    format_type: str = "json",
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Set up comprehensive logging configuration for the Ollama service.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_type: Format type ("json" or "text")
        log_file: Optional log file path
        
    Returns:
        Configured logger instance
    """
    
    # Convert string level to logging constant
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    
    # Create root logger
    logger = logging.getLogger("ollama_service")
    logger.setLevel(numeric_level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    
    # Set formatter based on format type
    if format_type.lower() == "json":
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
    
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Add file handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Set up other loggers
    logging.getLogger("ollama").setLevel(numeric_level)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # Reduce httpx noise
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    
    logger.info(f"Logging configured - Level: {level}, Format: {format_type}")
    
    return logger

def get_logger(name: str, **context) -> OllamaLoggerAdapter:
    """
    Get a logger adapter with context information.
    
    Args:
        name: Logger name
        **context: Additional context to include in log records
        
    Returns:
        Logger adapter with context
    """
    base_logger = logging.getLogger(f"ollama_service.{name}")
    return OllamaLoggerAdapter(base_logger, context)

# Error type constants for consistent error categorization
class ErrorTypes:
    CONNECTION_ERROR = "connection_error"
    TIMEOUT_ERROR = "timeout_error"
    MODEL_ERROR = "model_error"
    VALIDATION_ERROR = "validation_error"
    CONFIGURATION_ERROR = "configuration_error"
    UNKNOWN_ERROR = "unknown_error"

def log_error(logger: logging.Logger, error: Exception, error_type: str, **context):
    """
    Log an error with consistent formatting and context.
    
    Args:
        logger: Logger instance
        error: Exception that occurred
        error_type: Type of error (use ErrorTypes constants)
        **context: Additional context information
    """
    logger.error(
        f"{error_type}: {str(error)}",
        extra={
            "error_type": error_type,
            "exception_class": error.__class__.__name__,
            **context
        },
        exc_info=True
    )