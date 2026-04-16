# HR Workforce Analytics Platform — Project Structure

## Overview
Production-grade workforce intelligence platform with AI-powered analytics, LangGraph agent-based chatbot, and workforce lifecycle intelligence.

## Directory Structure

```
HR_ANALYTICS_PLATFORM/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app with async lifespan
│   │   ├── config.py                  # Pydantic settings
│   │   ├── database.py                # SQLAlchemy async + SQLite
│   │   ├── data_loader.py             # CSV loading & caching
│   │   │
│   │   ├── agent/                     # LangGraph agent (production)
│   │   │   ├── __init__.py
│   │   │   ├── graph.py               # 4-node pipeline
│   │   │   └── prompt_engine.py       # Dynamic prompts
│   │   │
│   │   ├── tools/                     # 9 specialized tools
│   │   │   ├── pandas_tool.py         # Analytical queries
│   │   │   ├── rag_tool.py            # Semantic search
│   │   │   ├── profile_tool.py        # Person profiling
│   │   │   ├── synthesis_tool.py      # Insight synthesis
│   │   │   ├── chart_tool.py          # Visualization
│   │   │   ├── graph_tool.py          # Graph queries
│   │   │   ├── dashboard_tool.py      # Navigation
│   │   │   ├── pipeline_tool.py       # Pipeline trigger
│   │   │   └── file_tool.py           # File processing
│   │   │
│   │   ├── routers/                   # API endpoints
│   │   │   ├── brain_router.py        # SSE streaming chat (LangGraph)
│   │   │   ├── workforce.py           # Headcount & composition
│   │   │   ├── turnover.py            # Attrition analytics
│   │   │   ├── tenure.py              # Tenure analysis
│   │   │   ├── careers.py             # Career progression
│   │   │   ├── managers.py            # Manager analytics
│   │   │   ├── org.py                 # Organization structure
│   │   │   ├── predictions.py         # Flight risk ML
│   │   │   ├── reports.py             # Executive reports
│   │   │   ├── upload.py              # Data upload
│   │   │   ├── settings.py            # Configuration
│   │   │   ├── taxonomy_router.py     # Taxonomy management
│   │   │   ├── pipeline_router.py     # Pipeline endpoints
│   │   │   └── ws.py                  # WebSocket support
│   │   │
│   │   └── services/                  # Business logic
│   │       ├── knowledge_base.py      # ChromaDB embeddings
│   │       ├── derived_fields.py      # Feature engineering
│   │       └── [other services]
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── pages/                     # 14 page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Workforce.tsx
│   │   │   ├── Turnover.tsx
│   │   │   ├── Tenure.tsx
│   │   │   ├── FlightRisk.tsx
│   │   │   ├── Careers.tsx
│   │   │   ├── Managers.tsx
│   │   │   ├── Org.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── Insights.tsx
│   │   │   ├── Upload.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── LandingPage.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── layout/                # Navigation & layout
│   │   │   ├── ui/                    # Design system components
│   │   │   └── chat/                  # Chat components
│   │   │       ├── ChatPanel.tsx
│   │   │       ├── ChatMessage.tsx
│   │   │       ├── ChatInput.tsx
│   │   │       ├── ChatTrigger.tsx
│   │   │       └── VoiceButton.tsx
│   │   │
│   │   ├── stores/
│   │   │   └── chatStore.ts           # Zustand state
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                 # HTTP client
│   │   │   ├── brainApi.ts            # SSE client
│   │   │   └── utils.ts
│   │   │
│   │   └── types/
│   │
│   ├── .env.development               # Port 8119
│   ├── package.json
│   └── tsconfig.json
│
├── wh_Dataset/                        # Workforce data
│   ├── function_wh.csv
│   ├── wh_history_full.csv
│   └── wh_user_history_v2.csv
│
├── docs/
│   ├── design-system.md
│   └── component-patterns.md
│
├── CLAUDE.md                          # Project charter
├── README.md                          # Quick start
├── ARCHITECTURE.md                    # Architecture docs
├── DEPLOYMENT.md                      # Deployment guide
└── PROJECT_STRUCTURE.md               # This file
```

## Key Technologies

### Backend
- FastAPI 0.111.0 (async, SSE streaming)
- SQLAlchemy 2.0 async + SQLite
- Pandas, NumPy, scikit-learn
- OpenAI (gpt-4o, gpt-4o-mini)
- LangGraph (production agent)
- ChromaDB + sentence-transformers
- Neo4j AuraDB + NetworkX

### Frontend
- React 18 + TypeScript (strict)
- Vite 8.0 (build tool)
- Tailwind CSS (dark theme)
- Recharts (visualization)
- Zustand (state management)
- Lucide React (icons)
- Axios (HTTP client)

## API Endpoints

### Workforce Analytics
- `/api/workforce/...` — Headcount, composition
- `/api/turnover/...` — Attrition rates, trends
- `/api/tenure/...` — Cohorts, distribution
- `/api/careers/...` — Progression, velocity
- `/api/managers/...` — Span of control, retention
- `/api/org/...` — Hierarchy, structure
- `/api/predictions/...` — Flight risk scores

### AI Chatbot (LangGraph)
- `POST /api/brain/chat` — SSE streaming
- `POST /api/brain/chat/sync` — JSON response
- `POST /api/brain/session/clear` — Clear history

### Data Management
- `POST /api/upload` — CSV upload
- `POST /api/pipeline/trigger` — Pipeline control
- `GET /api/reports/download` — Export

## Agent Architecture

```
Router → Tools → Synthesize → Hallucination Check
```

**Features:**
- 9 specialized tools
- Conversational memory (5 turns)
- Dynamic prompt generation
- Hallucination detection (0-1 confidence)
- Route badges (show which tool)
- Contextual suggestions

## Development

```bash
# Backend (port 8119)
cd backend && uvicorn app.main:app --reload --port 8119

# Frontend (port 3000)
cd frontend && npm run dev

# Access: http://localhost:3000/app
# Chat: Cmd+K or fire orb
```

## Deployment

- Production backend: Port 8119
- Frontend: Static build to CDN
- Database: SQLAlchemy migrations
- LLM: OpenAI API keys in .env
- Knowledge base: Auto-rebuild on startup

---
**Version:** 2.0.0 (Production)
**Status:** ✅ Deployed
**Last Updated:** 2026-04-16
