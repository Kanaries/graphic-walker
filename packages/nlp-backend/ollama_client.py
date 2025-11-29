import asyncio
import time
from typing import List, Optional, Dict, Any
import ollama
from config import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT, OLLAMA_FALLBACK_MODEL
from logging_config import get_logger, log_error, ErrorTypes
from sql_processor import sql_processor

logger = get_logger("ollama_client")

class OllamaClient:
    """
    Ollama client wrapper for handling local LLM inference with proper error handling,
    health checking, and configuration management.
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
        fallback_model: Optional[str] = None
    ):
        """
        Initialize Ollama client with configuration from environment variables or parameters.
        
        Args:
            base_url: Ollama server URL (defaults to OLLAMA_BASE_URL env var or localhost:11434)
            model: Primary model name (defaults to OLLAMA_MODEL env var or codellama:7b-instruct)
            timeout: Request timeout in seconds (defaults to OLLAMA_TIMEOUT env var or 60)
            fallback_model: Backup model if primary fails (defaults to OLLAMA_FALLBACK_MODEL env var)
        """
        self.base_url = base_url or OLLAMA_BASE_URL
        self.model = model or OLLAMA_MODEL
        self.timeout = timeout or OLLAMA_TIMEOUT
        self.fallback_model = fallback_model or OLLAMA_FALLBACK_MODEL
        
        # Configure ollama client
        self.client = ollama.Client(host=self.base_url)
        
        # Initialize model manager (lazy loading to avoid circular imports)
        self._model_manager = None
        
        logger.info(
            "OllamaClient initialized successfully",
            extra={
                "base_url": self.base_url,
                "primary_model": self.model,
                "fallback_model": self.fallback_model,
                "timeout": self.timeout
            }
        )
    
    async def health_check(self) -> bool:
        """
        Check if Ollama server is available and responsive.
        
        Returns:
            bool: True if server is healthy, False otherwise
        """
        try:
            # Run in thread pool since ollama client is synchronous
            loop = asyncio.get_event_loop()
            
            # Apply timeout to health check as well
            health_check_task = loop.run_in_executor(None, self.client.list)
            models = await asyncio.wait_for(health_check_task, timeout=10)  # 10 second timeout for health check
            
            logger.info("Ollama health check passed")
            return True
        except asyncio.TimeoutError as e:
            log_error(logger, e, ErrorTypes.TIMEOUT_ERROR, operation="health_check", timeout=10)
            return False
        except ConnectionError as e:
            log_error(logger, e, ErrorTypes.CONNECTION_ERROR, operation="health_check", base_url=self.base_url)
            return False
        except Exception as e:
            log_error(logger, e, ErrorTypes.UNKNOWN_ERROR, operation="health_check")
            return False
    
    def get_available_models(self) -> List[str]:
        """
        Get list of available models from Ollama server.
        
        Returns:
            List[str]: List of available model names
        
        Raises:
            ConnectionError: If unable to connect to Ollama server
            Exception: For other unexpected errors
        """
        try:
            models_response = self.client.list()
            # Handle both old dict format and new object format
            if hasattr(models_response, 'models'):
                # New format: models_response is an object with models attribute
                models = models_response.models
            else:
                # Old format: models_response is a dict
                models = models_response.get('models', [])
            
            model_names = []
            for model in models:
                if hasattr(model, 'model'):
                    # New format: model object with 'model' attribute
                    model_names.append(model.model)
                elif hasattr(model, 'name'):
                    # Alternative format: model object with 'name' attribute
                    model_names.append(model.name)
                elif isinstance(model, dict):
                    # Old format: model is a dict
                    model_names.append(model.get('name', str(model)))
                else:
                    # Fallback: convert to string
                    model_names.append(str(model))
            
            logger.info(f"Available models: {model_names}")
            return model_names
        except ConnectionError as e:
            log_error(logger, e, ErrorTypes.CONNECTION_ERROR, operation="get_available_models", base_url=self.base_url)
            raise ConnectionError(f"Unable to connect to Ollama server at {self.base_url}: {str(e)}")
        except Exception as e:
            log_error(logger, e, ErrorTypes.UNKNOWN_ERROR, operation="get_available_models")
            raise Exception(f"Error retrieving models from Ollama server: {str(e)}")
    
    async def generate_sql(self, prompt: str, model_override: Optional[str] = None) -> str:
        """
        Generate SQL from natural language prompt using Ollama.
        
        Args:
            prompt: Natural language description of desired SQL
            model_override: Optional model to use instead of default
            
        Returns:
            str: Generated SQL expression
            
        Raises:
            Exception: If generation fails or times out
        """
        target_model = model_override or self.model
        
        # Enhanced system prompt for computed field expressions
        system_prompt = """You are an expert SQL assistant for creating computed fields in Graphic Walker. 

IMPORTANT RULES:
1. Output ONLY the SQL expression - no explanations, no CREATE statements, no semicolons
2. For conditional logic, ALWAYS use CASE WHEN ... THEN ... ELSE ... END statements
3. For comparisons between fields, use CASE statements, NOT arithmetic operations
4. For mathematical calculations, use direct arithmetic expressions
5. Field names should be used as-is without quotes unless they contain spaces

EXAMPLES:
- "If field A > field B then 'High' else 'Low'" → CASE WHEN A > B THEN 'High' ELSE 'Low' END
- "Calculate 10% of price" → price * 0.1
- "If status is active then Premium else Basic" → CASE WHEN status = 'active' THEN 'Premium' ELSE 'Basic' END

Output ONLY the expression:"""
        
        start_time = time.time()
        
        try:
            logger.info(
                "Starting SQL generation",
                extra={
                    "model": target_model,
                    "prompt_length": len(prompt),
                    "prompt_preview": prompt[:100] + "..." if len(prompt) > 100 else prompt
                }
            )
            
            # Run in thread pool since ollama client is synchronous
            loop = asyncio.get_event_loop()
            
            # Create the generation task with timeout
            generation_task = loop.run_in_executor(
                None,
                self._generate_with_model,
                target_model,
                system_prompt,
                prompt
            )
            
            # Apply timeout
            response = await asyncio.wait_for(generation_task, timeout=self.timeout)
            
            # Process the response using advanced SQL processor
            processing_result = sql_processor.process_response(
                response, 
                context={
                    "model": target_model,
                    "prompt_length": len(prompt),
                    "request_timestamp": start_time
                }
            )
            cleaned_sql = processing_result.cleaned
            
            # Log processing details
            if processing_result.warnings:
                logger.warning(
                    "SQL processing warnings",
                    extra={
                        "model_used": target_model,
                        "warnings": processing_result.warnings,
                        "processing_steps": len(processing_result.processing_steps)
                    }
                )
            
            response_time = time.time() - start_time
            
            logger.info(
                "SQL generation completed successfully",
                extra={
                    "model_used": target_model,
                    "response_time": round(response_time, 3),
                    "sql_length": len(cleaned_sql),
                    "sql_preview": cleaned_sql[:100] + "..." if len(cleaned_sql) > 100 else cleaned_sql,
                    "processing_steps": len(processing_result.processing_steps),
                    "sql_complexity": processing_result.metadata.get("estimated_complexity", "unknown")
                }
            )
            
            return cleaned_sql
            
        except asyncio.TimeoutError as e:
            response_time = time.time() - start_time
            log_error(
                logger, e, ErrorTypes.TIMEOUT_ERROR,
                operation="generate_sql",
                model=target_model,
                timeout=self.timeout,
                response_time=round(response_time, 3),
                prompt_length=len(prompt)
            )
            
            # Try fallback model if available and different from primary
            if self.fallback_model and self.fallback_model != target_model:
                logger.info(
                    "Attempting fallback model due to timeout",
                    extra={"fallback_model": self.fallback_model, "failed_model": target_model}
                )
                try:
                    return await self.generate_sql(prompt, self.fallback_model)
                except Exception as fallback_error:
                    log_error(
                        logger, fallback_error, ErrorTypes.MODEL_ERROR,
                        operation="generate_sql_fallback",
                        fallback_model=self.fallback_model,
                        original_error="timeout"
                    )
            
            raise Exception(f"Request timeout after {self.timeout} seconds")
            
        except Exception as e:
            response_time = time.time() - start_time
            log_error(
                logger, e, ErrorTypes.MODEL_ERROR,
                operation="generate_sql",
                model=target_model,
                response_time=round(response_time, 3),
                prompt_length=len(prompt)
            )
            
            # Try fallback model if available and different from primary
            if self.fallback_model and self.fallback_model != target_model:
                logger.info(
                    "Attempting fallback model due to generation error",
                    extra={"fallback_model": self.fallback_model, "failed_model": target_model}
                )
                try:
                    return await self.generate_sql(prompt, self.fallback_model)
                except Exception as fallback_error:
                    log_error(
                        logger, fallback_error, ErrorTypes.MODEL_ERROR,
                        operation="generate_sql_fallback",
                        fallback_model=self.fallback_model,
                        original_error=str(e)
                    )
            
            raise Exception(f"Model inference failed: {str(e)}")
    
    def _generate_with_model(self, model: str, system_prompt: str, user_prompt: str) -> str:
        """
        Synchronous generation method to be run in thread pool.
        
        Args:
            model: Model name to use
            system_prompt: System instruction
            user_prompt: User's natural language prompt
            
        Returns:
            str: Raw response from model
        """
        response = self.client.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        return response['message']['content']
    
    def _clean_sql_response(self, response: str) -> str:
        """
        Clean SQL response by removing markdown formatting and code blocks.
        
        Args:
            response: Raw response from model
            
        Returns:
            str: Cleaned SQL expression
        """
        # Remove markdown code blocks and language tags
        cleaned = response.strip()
        
        # Remove code block markers
        if cleaned.startswith("```"):
            lines = cleaned.split('\n')
            # Remove first line (```sql or ```)
            lines = lines[1:]
            # Remove last line if it's just ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = '\n'.join(lines)
        
        # Remove inline code markers
        cleaned = cleaned.strip("`")
        
        # Remove common language tags
        if cleaned.lower().startswith("sql"):
            cleaned = cleaned[3:].strip()
        
        return cleaned.strip()
    
    def is_model_available(self, model_name: str) -> bool:
        """
        Check if a specific model is available on the Ollama server.
        
        Args:
            model_name: Name of the model to check
            
        Returns:
            bool: True if model is available, False otherwise
        """
        try:
            available_models = self.get_available_models()
            return model_name in available_models
        except Exception as e:
            logger.error(f"Failed to check model availability: {str(e)}")
            return False
    
    @property
    def model_manager(self):
        """Get or create ModelManager instance."""
        if self._model_manager is None:
            from model_manager import ModelManager
            self._model_manager = ModelManager(self)
        return self._model_manager
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get comprehensive model information including availability and configuration.
        
        Returns:
            Dict containing model configuration and availability info
        """
        return self.model_manager.get_model_info()
    
    def get_recommended_models(self) -> List[str]:
        """
        Get list of recommended models for SQL generation tasks.
        
        Returns:
            List[str]: Recommended model names available on the server
        """
        return self.model_manager.recommend_models_for_sql()
    
    async def generate_sql_with_details(self, prompt: str, model_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate SQL with detailed processing information.
        
        Args:
            prompt: Natural language description of desired SQL
            model_override: Optional model to use instead of default
            
        Returns:
            Dict containing SQL and detailed processing information
        """
        target_model = model_override or self.model
        system_prompt = "You are an expert SQL assistant for creating computed fields in Graphic Walker. Output ONLY the SQL expression."
        
        start_time = time.time()
        
        try:
            logger.info(
                "Starting detailed SQL generation",
                extra={
                    "model": target_model,
                    "prompt_length": len(prompt),
                    "include_details": True
                }
            )
            
            # Run in thread pool since ollama client is synchronous
            loop = asyncio.get_event_loop()
            generation_task = loop.run_in_executor(
                None,
                self._generate_with_model,
                target_model,
                system_prompt,
                prompt
            )
            
            # Apply timeout
            response = await asyncio.wait_for(generation_task, timeout=self.timeout)
            
            # Process the response with detailed information
            processing_result = sql_processor.process_response(
                response,
                context={
                    "model": target_model,
                    "prompt_length": len(prompt),
                    "request_timestamp": start_time
                }
            )
            
            response_time = time.time() - start_time
            
            # Validate SQL syntax
            validation_result = sql_processor.validate_sql_syntax(processing_result.cleaned)
            
            result = {
                "sql": processing_result.cleaned,
                "model_used": target_model,
                "response_time_ms": round(response_time * 1000, 2),
                "processing": processing_result.to_dict(),
                "validation": validation_result,
                "metadata": {
                    "prompt_length": len(prompt),
                    "original_response_length": len(response),
                    "cleaned_sql_length": len(processing_result.cleaned),
                    "timestamp": start_time
                }
            }
            
            logger.info(
                "Detailed SQL generation completed",
                extra={
                    "model_used": target_model,
                    "response_time": round(response_time, 3),
                    "sql_valid": validation_result["is_valid"],
                    "processing_warnings": len(processing_result.warnings),
                    "validation_errors": len(validation_result["errors"])
                }
            )
            
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            log_error(
                logger, e, ErrorTypes.MODEL_ERROR,
                operation="generate_sql_with_details",
                model=target_model,
                response_time=round(response_time, 3)
            )
            raise