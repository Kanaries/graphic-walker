# Frontend Integration Guide

## Overview

This guide documents the frontend integration with the Ollama NLP Backend for natural language to SQL conversion in computed fields.

## Vite Configuration

**File:** `vite.config.ts`

The proxy configuration routes all `/api/*` requests to the backend service:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3002',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, '/api'),
  },
}
```

This enables access to all backend endpoints including text-to-SQL conversion, health checks, and monitoring.

## Computed Field Component

**File:** `src/components/computedField/index.tsx`

The component uses the `/api/ollama-text2sql` endpoint to convert natural language prompts to SQL:

```typescript
const res = await fetch('/api/ollama-text2sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: grokPrompt })
});
const data = await res.json();

if (data.sql) {
  setSql(data.sql);
  setInputMode('sql');
} else if (data.error) {
  const errorMessage = data.details ? `${data.error}: ${data.details}` : data.error;
  setError(`Failed to generate SQL: ${errorMessage}`);
} else {
  setError('No SQL generated.');
}
```

## Optional Enhancements

### 1. Health Check Integration

Add health monitoring to your frontend:

```typescript
const checkBackendHealth = async () => {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    console.log('Backend health:', health.status);
  } catch (error) {
    console.warn('Backend health check failed:', error);
  }
};

// Check health on app start
checkBackendHealth();
```

### 2. Model Selection

Allow users to select different Ollama models:

```typescript
const [selectedModel, setSelectedModel] = useState('codellama:7b-instruct');

const res = await fetch('/api/ollama-text2sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    prompt: grokPrompt,
    model: selectedModel
  })
});
```

### 3. Performance Monitoring

Track API response times:

```typescript
const startTime = performance.now();
const res = await fetch('/api/ollama-text2sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: grokPrompt })
});
const endTime = performance.now();

console.log(`API call took ${endTime - startTime} milliseconds`);
```

## Testing the Integration

### 1. Start the Backend
```bash
cd packages/nlp-backend
pip install -r requirements.txt
uvicorn app:app --reload --port 3002
```

### 2. Start the Frontend
```bash
cd packages/graphic-walker
npm run dev
```

### 3. Test the Feature
1. Open the frontend at `http://localhost:2002`
2. Navigate to the computed field feature
3. Try generating SQL from natural language
4. Check the browser console for any errors

### 4. Verify Endpoints
Test the backend endpoints:
- `http://localhost:2002/api/health` - Basic health check
- `http://localhost:2002/api/models` - Available Ollama models
- `http://localhost:2002/api/monitoring/dashboard` - Monitoring dashboard

## Troubleshooting

### API Calls Failing
**Symptom:** Frontend shows "Failed to generate SQL" errors

**Solutions:**
- Verify the backend is running on port 3002
- Check that Ollama is installed and running
- Review browser console for detailed error messages
- Test the backend directly: `curl http://localhost:3002/api/health`

### Proxy Not Working
**Symptom:** 404 errors for API calls

**Solutions:**
- Restart the Vite dev server after config changes
- Verify proxy configuration in `vite.config.ts`
- Ensure backend is accessible at `http://localhost:3002`

### Slow Response Times
**Symptom:** Long wait times for SQL generation

**Solutions:**
- Check system resources (CPU/Memory)
- Consider using smaller Ollama models
- Increase timeout values in backend configuration
- Monitor performance with `/api/health/metrics`

### Debug Mode

Enable debug logging:

```typescript
const debugMode = import.meta.env.DEV;

if (debugMode) {
  console.log('API Request:', { prompt: grokPrompt });
  console.log('API Response:', data);
}
```

## Integration Checklist

### Core Setup
- [x] Vite proxy configuration for `/api/*` routes
- [x] Computed field component using `/api/ollama-text2sql`
- [x] Enhanced error handling and reporting
- [x] Backend service running on port 3002

### Optional Enhancements
- [ ] Health check integration
- [ ] Model selection UI
- [ ] Performance monitoring
- [ ] Detailed processing information display

## Next Steps

1. **Test thoroughly** with various SQL generation scenarios
2. **Monitor performance** using health check endpoints
3. **Consider adding** optional enhancements based on your needs
4. **Update team documentation** about the integration
5. **Plan deployment** strategy for production

## Production Considerations

### Performance
- Monitor response times and adjust timeouts as needed
- Consider caching common SQL expressions
- Use appropriate Ollama models for your use case

### Reliability
- Implement retry logic for failed requests
- Add fallback UI for when backend is unavailable
- Monitor health endpoints regularly

### User Experience
- Show loading indicators during SQL generation
- Allow users to edit generated SQL
- Provide clear error messages
- Add tooltips and help text

The Ollama NLP Backend provides a robust, privacy-focused solution for natural language to SQL conversion with excellent performance and reliability.
