# Ollama NLP Backend for Custom Computed Fields

A local LLM-powered service that generates SQL expressions for custom computed fields in Graphic Walker using natural language prompts. This service uses Ollama for private, on-premises processing with no external API dependencies.

## **Features**

- **Local Processing** - Runs entirely on your infrastructure using Ollama
- **Smart SQL Generation** - Converts natural language to proper SQL expressions
- **Editable Results** - Generated SQL can be modified in the UI
- **Reliable** - Automatic model fallback and comprehensive error handling
- **Monitoring** - Built-in health checks and performance metrics
- **REST API** - Simple HTTP endpoints for integration

## **Complete Documentation**

For full setup, configuration, and usage details:

**[OLLAMA_NLP_BACKEND_GUIDE.md](./OLLAMA_NLP_BACKEND_GUIDE.md)**

This comprehensive guide includes:
- Installation and setup
- Configuration options
- API documentation
- Usage examples
- Troubleshooting guide

## **Quick Start**

### 1. Install Ollama
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
ollama pull codellama:7b-instruct
```

### 2. Start Service
```bash
cd packages/nlp-backend
pip install -r requirements.txt
uvicorn app:app --reload --port 3002
```

### 3. Test
```bash
curl -X POST http://localhost:3002/api/ollama-text2sql \
  -H "Content-Type: application/json" \
  -d '{"prompt": "If revenue > 1000 then High else Low"}'
```

**Response:**
```json
{
  "sql": "CASE WHEN revenue > 1000 THEN 'High' ELSE 'Low' END"
}
```

## **Key Features**

- **Local Processing** - Runs entirely on your infrastructure
- **Smart SQL Generation** - Proper CASE statements for conditional logic
- **Editable Results** - Generated SQL can be modified in the UI
- **Fallback Support** - Automatic model fallback for reliability
- **Health Monitoring** - Comprehensive health checks and metrics

---

**For complete setup, configuration, and usage details, see [OLLAMA_NLP_BACKEND_GUIDE.md](./OLLAMA_NLP_BACKEND_GUIDE.md)**