# Workforce IQ Brain — Quick Start Guide

## TL;DR (30 seconds)

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000 and click the fire orb 🔥 in the bottom-right corner.

---

## Full Setup (5 minutes)

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key (or OpenRouter)

### Step 1: Clone & Setup Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure API Key

```bash
# Set one of these:
export OPENAI_API_KEY="sk-..."          # OpenAI
export OPENROUTER_API_KEY="sk-or-..."   # OpenRouter (free)
export LLM_PROVIDER="openrouter"        # If using OpenRouter
```

### Step 3: Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

**Expected output:**
```
Workforce data loaded from wh_Dataset
Recognition data loaded from wh_Dataset
[OK] Knowledge base built: 25 documents
Uvicorn running on http://127.0.0.1:8000
```

### Step 4: Start Frontend (New terminal)

```bash
cd frontend
npm install
npm run dev
```

**Expected output:**
```
VITE v6.0.0  ready in 234 ms
➜  Local:   http://localhost:3000/
```

### Step 5: Access the App

1. Open http://localhost:3000
2. Click the fire orb 🔥 in bottom-right corner
3. Type: "How many employees do we have?"
4. Watch the AI respond with workforce analytics

---

## What's Included

### Backend (Python/FastAPI)
- **Brain Agent**: LangGraph state machine with intent routing
- **Knowledge Base**: ChromaDB with 25+ embedded documents
- **Analytics**: 15+ KPI query types
- **Reports**: Executive summaries & PDF export
- **Memory**: Per-user conversation context

### Frontend (React/TypeScript)
- **Chat Panel**: Fire orb FAB with message history
- **Input**: File upload, voice recording, markdown rendering
- **Reports**: Display & export as PDF
- **State**: Zustand store for chat history

### Data
- 2,466 employees across 20+ departments
- 11,803 job history records (career progression)
- 1,000+ recognition awards (engagement data)

---

## Common Commands

### Backend Testing
```bash
cd backend
python -m pytest tests/ -v
```

### Frontend Building
```bash
cd frontend
npm run build  # Creates dist/ for deployment
```

### Data Pipeline
```bash
curl -X POST http://localhost:8000/api/upload/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"message": "CSV file"}'
```

### Check Health
```bash
curl http://localhost:8000/api/brain/health
```

---

## Troubleshooting

### "Connection refused" on http://localhost:3000
- Frontend dev server not running. Run `npm run dev` in frontend folder

### "Data not loaded" error
- Check backend logs for data loading errors
- Ensure `wh_Dataset/` folder exists with CSV files

### "API key not configured"
- Set `OPENAI_API_KEY` or `OPENROUTER_API_KEY` before starting backend
- Restart backend after setting key

### Chat responses are slow
- First query embeds knowledge base (takes ~5s)
- Subsequent queries are faster (~1s)

---

## Next Steps

1. **Try Sample Queries**
   - "What's our turnover rate?"
   - "Show me headcount by department"
   - "Who's been here the longest?"
   - "Create an executive summary"

2. **Upload New Data**
   - POST to `/api/upload/pipeline/run` with CSV
   - Pipeline auto-embeds to knowledge base

3. **Export Reports**
   - Click report panel in chat
   - Download as PDF or copy to clipboard

4. **Deploy**
   - See DEPLOYMENT.md for production setup
   - Docker/docker-compose ready

---

## Architecture at a Glance

```
Browser (React 19)
    ↓
Chat Panel (fire orb FAB)
    ↓
POST /api/brain/chat
    ↓
BrainAgent (LangGraph)
    ├─ Intent routing
    ├─ ChromaDB search
    ├─ Analytics engine
    └─ LLM generation
    ↓
Response + suggestions
```

---

## Support

- **Logs**: `uvicorn` console output (backend) / Browser DevTools (frontend)
- **Health**: `GET /api/brain/health`
- **Data Status**: `GET /api/upload/status`
- **API Docs**: http://localhost:8000/docs (Swagger UI)

---

**Ready to go!** 🚀

