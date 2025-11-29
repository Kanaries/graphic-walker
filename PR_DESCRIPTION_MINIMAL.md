# Ollama NLP Backend for Custom Computed Fields - Minimal PR Description

## Summary
Adds a complete local LLM backend for generating SQL expressions from natural language using Ollama. No external API dependencies—runs entirely on-premises for privacy and cost-efficiency.

**📹 Includes demonstration video: [NLP-Based Compute Field](./packages/nlp-backend/NLP-Based-Compute-Field.mp4)**

## What Changed

### New Package: `packages/nlp-backend/`

**Core Components:**
- `app.py` - FastAPI service with 15+ REST endpoints
- `ollama_client.py` - Ollama integration with async support and fallback logic
- `sql_processor.py` - Advanced SQL processing: markdown removal, pattern cleaning, validation
- `ollama_service.py` - Service layer with request tracking
- `model_manager.py` - Model selection, validation, and caching
- `health_monitor.py` - Startup validation and health checks
- `metrics_collector.py` - Request metrics and performance tracking
- `monitoring_dashboard.py` - Dashboard data aggregation
- `logging_config.py` - Structured JSON logging
- `config.py` - Configuration management
- `requirements.txt` - Dependencies

**Documentation:**
- `README.md` - Quick start guide
- `OLLAMA_NLP_BACKEND_GUIDE.md` - Comprehensive setup and usage guide

## Key Features

✅ **Local SQL Generation** - Natural language → SQL via Ollama  
✅ **Smart Processing** - Handles CASE WHEN, mathematical operations, field names  
✅ **Robust** - Error handling, model fallbacks, comprehensive logging  
✅ **Observable** - Health checks, metrics collection, monitoring dashboard  
✅ **REST API** - 15+ endpoints for generation, monitoring, and analytics  

## Quick Start

```bash
# 1. Install Ollama and pull model
ollama pull codellama:7b-instruct

# 2. Start backend
cd packages/nlp-backend
pip install -r requirements.txt
uvicorn app:app --port 3002

# 3. Test
curl -X POST http://localhost:3002/api/ollama-text2sql \
  -H "Content-Type: application/json" \
  -d '{"prompt": "If revenue > 1000 then High else Low"}'

# Response: {"sql": "CASE WHEN revenue > 1000 THEN 'High' ELSE 'Low' END"}
```

## API Endpoints

**Primary:**
- `POST /api/ollama-text2sql` - Generate SQL
- `POST /api/ollama-text2sql/detailed` - Generate SQL with details
- `POST /api/sql/process` - Process raw responses

**Health & Info:**
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Full health info
- `GET /api/service-info` - Service status
- `GET /api/models` - Available models

**Monitoring:**
- `GET /api/monitoring/dashboard` - Full dashboard data
- `GET /api/monitoring/real-time` - Real-time metrics
- `GET /api/metrics/summary` - Metrics overview
- `GET /api/metrics/export?format=json|prometheus` - Export metrics

## Configuration

Environment variables:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=codellama:7b-instruct
OLLAMA_TIMEOUT=90
OLLAMA_FALLBACK_MODEL=llama3.2:latest
LOG_LEVEL=INFO
LOG_FORMAT=json
```

## Why This PR

1. **Enables Custom Computed Fields** - Users can generate SQL from natural language
2. **Privacy-First** - All processing happens locally, no external APIs
3. **Cost-Efficient** - No API bills, uses local resources
4. **Production-Ready** - Error handling, monitoring, fallbacks included
5. **Observable** - Built-in metrics and health checks for operational visibility

## Files Added
- 10 Python modules (app, service, processing, monitoring, logging)
- 2 documentation files
- 1 requirements file
- 0 breaking changes

## Testing
- ✅ Startup validation
- ✅ Health checks
- ✅ SQL generation with fallbacks
- ✅ Error handling
- ✅ Metrics collection
- ✅ Monitoring endpoints

## Deployment
Prerequisites: Ollama running locally with at least one model pulled.

```bash
pip install -r requirements.txt
uvicorn app:app --port 3002
```

Production use: Add Gunicorn, configure logging, set up monitoring.

## Demo

<video width="100%" controls>
  <source src="./packages/nlp-backend/NLP-Based-Compute-Field.mp4" type="video/mp4">
  Your browser does not support the video tag. <a href="./packages/nlp-backend/NLP-Based-Compute-Field.mp4">Download video</a>
</video>

**Example SQL Generations:**
```
Prompt: "If revenue > 1000 then High else Low"
→ CASE WHEN revenue > 1000 THEN 'High' ELSE 'Low' END

Prompt: "Calculate 10% of price"
→ price * 0.1

Prompt: "If status is active then Premium else Basic"
→ CASE WHEN status = 'active' THEN 'Premium' ELSE 'Basic' END
```

---

**For complete details: See [PR_DESCRIPTION_FULL.md](./PR_DESCRIPTION_FULL.md) or [OLLAMA_NLP_BACKEND_GUIDE.md](./packages/nlp-backend/OLLAMA_NLP_BACKEND_GUIDE.md)**
