# Workforce IQ — Quick Start Guide

## TL;DR (30 seconds)

```bash
# Terminal 1: Backend (port 8119)
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."
python -m uvicorn app.main:app --reload --port 8119

# Terminal 2: Frontend (port 3000)
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000 and click the fire orb 🔥 in the bottom-right corner to chat with your workforce data.

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

### Step 3: Start Backend (Port 8119)

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8119
```

**Expected output:**
```
Workforce data loaded: 2,466 employees
Career moves classified: 3,297 moves
[OK] Knowledge base built: 25+ documents
Application startup complete
Uvicorn running on http://127.0.0.1:8119
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
- **Analytics Engine**: 50+ endpoints across 8 categories (workforce, turnover, tenure, careers, managers, org, predictions, reports)
- **Brain Agent**: LangGraph state machine with intent routing (analytics vs. knowledge base)
- **Knowledge Base**: ChromaDB with 25+ embedded documents about workforce metrics
- **ML Predictions**: Flight risk scoring (LogisticRegression on tenure, role changes, manager churn)
- **Memory Manager**: SQLite persistence for per-user conversation context

### Frontend (React/TypeScript)
- **14 Analytics Pages**: Dashboard, Workforce Composition, Turnover, Tenure, Flight Risk, Careers, Managers, Org Structure, Chat, Insights, Upload, Reports, Settings
- **Chat Panel**: Fire orb FAB with natural language queries ("What's our attrition?")
- **Design System**: Premium dark theme with glass panels, orange accent, Recharts visualization
- **State Management**: Zustand store for chat history, user preferences, analytics state

### Data
- **2,466 employees** across 20+ departments, 13 job levels, 30+ locations
- **11,803 job history records** (average 4.8 moves per person for career progression analysis)
- **Key metrics**: turnover, tenure, promotion velocity, span of control, manager retention

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

### Backend not responding
- Verify backend running on http://localhost:8119 (not 8000)
- Check backend logs for startup errors
- Ensure data files in `wh_Dataset/` folder exist

### Chat responses are slow
- First chat request processes analytics (5–10ms) and LLM formatting (300–500ms)
- Subsequent requests cached (much faster)

---

## Next Steps

1. **Try Sample Queries**
   - "How many employees do we have?"
   - "What's our turnover rate?"
   - "Show me headcount by department"
   - "Who's at flight risk?"
   - "Which managers have the best team retention?"
   - "How many people have been in the same role for 3+ years?"
   - "What's the average tenure by grade?"
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
Browser (React 18)
    ↓
Dashboard + Chat (fire orb FAB)
    ↓
/api/chat (natural language)
/api/workforce/* (analytics)
/api/turnover/* (attrition)
    ↓
FastAPI Backend (Port 8119)
    ├─ Analytics Engine (cached DataFrames)
    ├─ BrainAgent (LangGraph)
    ├─ Knowledge Base (ChromaDB)
    ├─ ML Flight Risk (scikit-learn)
    └─ Memory Manager (SQLite)
    ↓
Response + charts + suggestions
```

---

## Support

- **Logs**: `uvicorn` console output (backend) / Browser DevTools (frontend)
- **Health**: `GET /api/` (root endpoint)
- **API Docs**: http://localhost:8119/docs (Swagger/OpenAPI)
- **More Info**: See README.md, ARCHITECTURE.md, FEATURES.md

---

**Ready to go!** 🚀

