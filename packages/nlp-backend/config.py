import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Ollama Configuration - reads from .env file
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "codellama:7b-instruct")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "90"))
OLLAMA_FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "llama3.2:latest")

def get_config_summary() -> dict:
    """
    Get all configuration values for debugging and logging.
    
    Returns:
        dict: Configuration summary including Ollama settings
    """
    return {
        "ollama_base_url": OLLAMA_BASE_URL,
        "ollama_model": OLLAMA_MODEL,
        "ollama_timeout": OLLAMA_TIMEOUT,
        "ollama_fallback_model": OLLAMA_FALLBACK_MODEL,
    }