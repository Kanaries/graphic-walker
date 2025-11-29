import logging
from typing import List, Optional, Dict, Any
from config import OLLAMA_MODEL, OLLAMA_FALLBACK_MODEL

logger = logging.getLogger(__name__)

class ModelManager:
    """
    Manages model selection, validation, and fallback logic for Ollama client.
    """
    
    def __init__(self, ollama_client):
        """
        Initialize ModelManager with an OllamaClient instance.
        
        Args:
            ollama_client: Instance of OllamaClient for model operations
        """
        self.ollama_client = ollama_client
        self.primary_model = OLLAMA_MODEL
        self.fallback_model = OLLAMA_FALLBACK_MODEL
        self._available_models_cache = None
        self._cache_valid = False
    
    def get_primary_model(self) -> str:
        """Get the primary model name."""
        return self.primary_model
    
    def get_fallback_model(self) -> Optional[str]:
        """Get the fallback model name."""
        return self.fallback_model
    
    def set_primary_model(self, model_name: str) -> None:
        """
        Set the primary model name.
        
        Args:
            model_name: Name of the model to set as primary
        """
        self.primary_model = model_name
        logger.info(f"Primary model set to: {model_name}")
    
    def set_fallback_model(self, model_name: Optional[str]) -> None:
        """
        Set the fallback model name.
        
        Args:
            model_name: Name of the model to set as fallback, or None to disable fallback
        """
        self.fallback_model = model_name
        logger.info(f"Fallback model set to: {model_name}")
    
    def get_available_models(self, use_cache: bool = True) -> List[str]:
        """
        Get list of available models, with optional caching.
        
        Args:
            use_cache: Whether to use cached results if available
            
        Returns:
            List[str]: List of available model names
        """
        if use_cache and self._cache_valid and self._available_models_cache:
            return self._available_models_cache
        
        try:
            models = self.ollama_client.get_available_models()
            self._available_models_cache = models
            self._cache_valid = True
            return models
        except Exception as e:
            logger.error(f"Failed to get available models: {str(e)}")
            # Return cached models if available, otherwise empty list
            return self._available_models_cache or []
    
    def validate_model_availability(self, model_name: str) -> bool:
        """
        Validate if a model is available on the server.
        
        Args:
            model_name: Name of the model to validate
            
        Returns:
            bool: True if model is available, False otherwise
        """
        try:
            available_models = self.get_available_models()
            return model_name in available_models
        except Exception as e:
            logger.error(f"Failed to validate model {model_name}: {str(e)}")
            return False
    
    def get_best_available_model(self, preferred_models: List[str]) -> Optional[str]:
        """
        Get the best available model from a list of preferred models.
        
        Args:
            preferred_models: List of model names in order of preference
            
        Returns:
            Optional[str]: First available model from the list, or None if none available
        """
        available_models = self.get_available_models()
        
        for model in preferred_models:
            if model in available_models:
                logger.info(f"Selected model: {model}")
                return model
        
        logger.warning(f"None of the preferred models {preferred_models} are available")
        return None
    
    def get_model_for_request(self, model_override: Optional[str] = None) -> str:
        """
        Determine which model to use for a request, considering overrides and availability.
        
        Args:
            model_override: Optional model override for this specific request
            
        Returns:
            str: Model name to use for the request
            
        Raises:
            Exception: If no suitable model is available
        """
        # Priority order: override -> primary -> fallback
        candidates = []
        
        if model_override:
            candidates.append(model_override)
        
        candidates.append(self.primary_model)
        
        if self.fallback_model:
            candidates.append(self.fallback_model)
        
        # Find first available model
        selected_model = self.get_best_available_model(candidates)
        
        if not selected_model:
            available_models = self.get_available_models()
            if available_models:
                # Use any available model as last resort
                selected_model = available_models[0]
                logger.warning(f"Using fallback to first available model: {selected_model}")
            else:
                raise Exception("No models available on Ollama server")
        
        return selected_model
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get comprehensive information about model configuration and availability.
        
        Returns:
            Dict containing model configuration and availability info
        """
        available_models = self.get_available_models()
        
        return {
            "primary_model": self.primary_model,
            "primary_available": self.primary_model in available_models,
            "fallback_model": self.fallback_model,
            "fallback_available": self.fallback_model in available_models if self.fallback_model else None,
            "available_models": available_models,
            "total_available": len(available_models),
            "cache_valid": self._cache_valid
        }
    
    def refresh_model_cache(self) -> None:
        """Force refresh of the available models cache."""
        self._cache_valid = False
        self.get_available_models(use_cache=False)
        logger.info("Model cache refreshed")
    
    def recommend_models_for_sql(self) -> List[str]:
        """
        Get recommended models for SQL generation tasks, in order of preference.
        
        Returns:
            List[str]: Recommended model names for SQL tasks
        """
        # Models known to be good for code/SQL generation
        sql_models = [
            "codellama:7b-instruct",
            "codellama:13b-instruct", 
            "codellama:34b-instruct",
            "llama3:8b-instruct",
            "llama3:70b-instruct",
            "mistral:7b-instruct",
            "mixtral:8x7b-instruct"
        ]
        
        available_models = self.get_available_models()
        recommended = [model for model in sql_models if model in available_models]
        
        logger.info(f"Recommended SQL models: {recommended}")
        return recommended