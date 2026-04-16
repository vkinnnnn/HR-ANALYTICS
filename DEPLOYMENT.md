# Deployment Guide — Workforce IQ Brain

## System Status: READY FOR DEPLOYMENT ✓

All phases complete. System fully tested and integrated.

### What's Included

#### Backend Services
- **LangGraph Agent (`brain.py`)**: Intent routing with 3 analysis paths
  - Analytics queries → KPI computation
  - Knowledge queries → ChromaDB semantic search
  - General responses → LLM generation
  
- **ChromaDB Vector Store (`knowledge_base.py`)**: 25+ embedded documents
  - Workforce overview, department distribution, grade hierarchy
  - Recognition intelligence, engagement metrics
  - Platform capabilities and insights
  
- **Analytics Engine (`analytics_engine.py`)**: 15+ query types
  - headcount_summary, headcount_by_dept/grade/function/location/country
  - tenure_summary, tenure_cohorts
  - promotion_stats, manager_span
  - recognition_summary
  
- **Report Generator (`report_generator.py`)**: 4 report types
  - Executive summaries with KPI narrative
  - KPI JSON exports (all metrics)
  - Department-specific analytics
  - Manager effectiveness reports
  
- **Memory Manager (`memory_manager.py`)**: Per-user persistent memory
  - Save/retrieve facts for conversation context
  - GDPR-compliant clearing

#### Frontend Components
- **ChatPanel.tsx**: Main chat interface
  - Fire orb FAB (bottom-right)
  - Message history with markdown rendering
  - Multi-turn conversations
  - Keyboard shortcuts (Cmd+K to toggle)
  
- **ChatInput.tsx**: Rich input bar
  - File uploads (CSV, XLSX, PDF, images)
  - Voice recording (Web Speech API)
  - Auto-expanding textarea
  - Shift+Enter for newlines
  
- **ReportPanel.tsx**: Report display & export
  - Executive summaries
  - KPI exports
  - PDF download (jsPDF)
  - Copy to clipboard

#### Data Pipeline
- **Input**: CSV upload via `/api/upload/pipeline/run`
- **Validation**: File type checking, column detection
- **Processing**: Load → enrich → taxonomy classification
- **Embedding**: Knowledge base rebuild with 25+ documents
- **Output**: Ready for chat queries

### Deployment Steps

#### 1. Environment Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..." # or OPENROUTER_API_KEY
export LLM_PROVIDER="openai" # or "openrouter"

# Frontend
cd ../frontend
npm install
npm run build
```

#### 2. Backend Startup

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Startup sequence**:
1. Initializes database
2. Loads workforce data from `wh_Dataset/`
3. Runs taxonomy classification (3,297 career moves)
4. Embeds knowledge base (25 documents)
5. Ready at `http://localhost:8000`

**Key endpoints**:
- `GET /api/brain/health` — Service status
- `GET /api/brain/report/summary` — Executive summary
- `GET /api/brain/report/kpis` — KPI export
- `POST /api/brain/chat` — Main chat endpoint
- `GET /api/upload/status` — Data loading status
- `POST /api/upload/pipeline/run` — Trigger full pipeline

#### 3. Frontend Startup (Development)

```bash
cd frontend
npm run dev  # Port 3000
```

**Startup sequence**:
1. Vite loads React 19 + TypeScript
2. Zustand initializes chat state
3. ChatPanel renders with fire orb FAB
4. API client configured for `http://localhost:8000`
5. Ready at `http://localhost:3000`

**Production build**:
```bash
npm run build  # Creates dist/
# Deploy dist/ to Firebase Hosting or Cloud CDN
```

#### 4. Verify Integration

Test the full workflow:
```bash
# 1. Check backend health
curl http://localhost:8000/api/brain/health

# 2. Get executive summary
curl http://localhost:8000/api/brain/report/summary

# 3. Get KPIs
curl http://localhost:8000/api/brain/report/kpis

# 4. Post a chat message (via frontend)
# Open http://localhost:3000 → Cmd+K → Type query
```

### Data Files

Required in `wh_Dataset/`:
- `function_wh.csv` — Employee master (2,466 rows)
- `wh_history_full.csv` — Job change history (11,803 rows)
- `wh_user_history_v2.csv` — Enriched subset (100 rows)
- `annotated_results.csv` — Recognition awards (1,000 rows)

Generated during startup:
- `chroma_data/` — ChromaDB vector store (in .gitignore)
- `hr_platform.db` — SQLite metadata (in .gitignore)

### Testing Results

✓ All 6 integration tests pass
- Imports: All services load correctly
- Data loading: 2,466 employees, 1,110 active
- Analytics engine: 15+ queries execute
- Report generation: Executive summaries & KPIs
- Memory manager: Save/retrieve/clear works
- API endpoints: 4/4 critical endpoints return 200

✓ Frontend TypeScript compilation: 0 errors
✓ Package dependencies: Complete
  - React 19.2.4
  - Zustand 5.0.12
  - Axios 1.13.6
  - jsPDF 4.2.1

### Production Checklist

Before deploying to production:

- [ ] Set environment variables (API keys)
- [ ] Configure CORS origins in backend/app/main.py
- [ ] Update frontend API URL in .env.production
- [ ] Test data pipeline with real CSVs
- [ ] Configure ChromaDB persistence path
- [ ] Set up database backups
- [ ] Enable monitoring (Sentry already wired)
- [ ] Add rate limiting to chat endpoint
- [ ] Implement authentication (currently open)
- [ ] Configure HTTPS/TLS certificates
- [ ] Set up CloudFront/CDN for frontend
- [ ] Configure database connection pooling

### Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Browser (React 19)              │
│  ┌──────────────────────────────────┐   │
│  │ ChatPanel (fire orb FAB)         │   │
│  │ - Messages with markdown         │   │
│  │ - File upload, voice input       │   │
│  │ - Report panel (PDF export)      │   │
│  └──────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ POST /api/brain/chat
               │ GET /api/brain/report/*
               ↓
┌─────────────────────────────────────────┐
│    Backend (FastAPI + async)            │
│  ┌──────────────────────────────────┐   │
│  │ BrainAgent (LangGraph)           │   │
│  │ ├─ router (intent)               │   │
│  │ ├─ search_kb (semantic search)   │   │
│  │ ├─ query_analytics (KPI)         │   │
│  │ └─ respond (LLM generation)      │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ Data Layer                       │   │
│  │ ├─ Pandas DataFrames (cached)    │   │
│  │ ├─ ChromaDB (embeddings)         │   │
│  │ ├─ SQLite (metadata)             │   │
│  │ └─ Analytics Engine              │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### Configuration

#### Backend (.env)
```
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
CHROMA_PERSIST_DIR=./chroma_data
DATABASE_URL=sqlite+aiosqlite:///./hr_platform.db
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

#### Frontend (.env.production)
```
VITE_API_URL=https://api.yourdomain.com
```

### Support

For issues or questions, check:
- Backend logs: `uvicorn` console output
- Frontend logs: Browser DevTools → Console
- API responses: Use curl or Postman
- Data status: `GET /api/upload/status`

### Success Indicators

You'll know it's working when:
1. Browser shows fire orb FAB in bottom-right corner
2. Clicking it opens chat panel with welcome message
3. Typing a query shows animated skeleton loaders
4. Chat responds with workforce analytics insights
5. Download button exports reports as PDF
6. Reports panel shows executive summary
