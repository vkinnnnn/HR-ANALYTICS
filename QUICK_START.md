# 🚀 Quick Start Guide — Local Deployment

## Prerequisites
- Python 3.8+ installed
- Node.js 16+ installed
- Git configured

## Step 1: Backend Setup (Terminal 1)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8119 --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8119
INFO:     Application startup complete
```

✅ Backend is ready when you see "Application startup complete"

The backend will automatically:
- Initialize SQLite database
- Load CSV files from wh_Dataset/
- Enrich data with derived fields
- Build ChromaDB knowledge base
- Initialize LangGraph agent

**Test the API:**
```bash
# In another terminal, test:
curl http://localhost:8119/

# Should return: {"message": "HR Workforce Analytics Platform", "version": "2.0.0", ...}
```

---

## Step 2: Frontend Setup (Terminal 2)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Expected output:**
```
  VITE v8.0.3  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Press q to quit
```

✅ Frontend is ready when you see the local URL

---

## Step 3: Access the Application

### Open Browser
```
http://localhost:3000/app
```

### Open Chat
Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux)
Or click the **fire orb** button in bottom-right corner

### Test the Chatbot
Try these queries:
```
- "What is our headcount?"
- "Show turnover trends"
- "Who is at flight risk?"
- "Show promotion velocity by department"
```

Expected behavior:
- ✅ Message streams in real-time
- ✅ Route badge appears (shows which tool was used)
- ✅ Suggestions appear below response
- ✅ No errors in browser console

---

## Environment Variables

### Backend (.env in backend/)
```env
# API
API_PORT=8119
API_HOST=0.0.0.0

# LLM (Required)
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=sqlite:///./app.db

# Data
DATA_DIR=./wh_Dataset

# CORS
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.development in frontend/)
```env
VITE_API_URL=http://localhost:8119
```

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 8119 is in use
lsof -i :8119
# or on Windows: netstat -ano | findstr :8119

# Kill the process using that port
kill -9 <PID>
# Then restart
```

### Knowledge base not building
```bash
# The backend will rebuild on startup if:
# 1. CSV files are in wh_Dataset/
# 2. OPENAI_API_KEY is set
# 3. Database is writable

# Check logs for errors
tail -f app.log  # or console output
```

### Chat not working
```bash
# Check browser console (F12 → Console tab)
# Verify backend is running: curl http://localhost:8119/
# Verify CORS_ORIGINS includes http://localhost:3000
# Check that OPENAI_API_KEY is set
```

### Port already in use
```bash
# Backend (8119)
lsof -i :8119 | kill -9 $(awk 'NR!=1 {print $2}')

# Frontend (3000)
lsof -i :3000 | kill -9 $(awk 'NR!=1 {print $2}')
```

---

## Verify Deployment

### Backend Health Check
```bash
# Should return 200 with data
curl http://localhost:8119/

# Example response:
# {
#   "message": "HR Workforce Analytics Platform",
#   "version": "2.0.0",
#   "data": {
#     "total_employees": 2466,
#     "active_employees": 2100,
#     ...
#   }
# }
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:8119/api/brain/chat \
  -F "message=What is our headcount?" \
  -F "session_id=test-session" \
  -F "current_page=/dashboard"

# Should return SSE stream with tokens and metadata
```

### Frontend Check
```bash
# Browser should show:
# ✅ Dashboard loading
# ✅ Sidebar visible with 5 nav groups
# ✅ Fire orb in bottom-right
# ✅ No errors in console
```

---

## Development Workflow

### Making Changes

**Backend:**
- Edit files in `backend/app/`
- Server auto-reloads (--reload flag)
- Check console for errors

**Frontend:**
- Edit files in `frontend/src/`
- Vite hot-reloads (changes appear instantly)
- Check browser console (F12) for errors

### Building for Production

**Backend:**
```bash
# No build step needed, just deploy the code
# Production: uvicorn app.main:app --port 8119 --workers 4
```

**Frontend:**
```bash
cd frontend
npm run build
# Creates dist/ folder ready for CDN
```

---

## Common Tasks

### Clear Chat History
```bash
# Backend clears automatically per session
# To completely reset:
rm app.db
# Restart backend
```

### Rebuild Knowledge Base
```bash
# Happens automatically on startup
# To force rebuild, delete:
rm -rf chroma_data/
# Restart backend
```

### Update Dependencies
```bash
# Backend
pip install -r requirements.txt --upgrade

# Frontend
npm update
```

### View Logs
```bash
# Backend logs print to terminal where you started it
# Frontend logs print to terminal where you started it
# Browser logs visible in DevTools (F12)
```

---

## Next Steps

1. ✅ Start backend and frontend
2. ✅ Open http://localhost:3000/app
3. ✅ Test the chat with Cmd+K
4. ✅ Explore all 14 pages
5. ✅ Try different queries in chat
6. 📖 Read PROJECT_STRUCTURE.md for detailed architecture
7. 🚀 Follow DEPLOYMENT_CHECKLIST.md for production

---

## Support

| Issue | Solution |
|-------|----------|
| Server won't start | Check port availability, verify dependencies installed |
| Chat not responding | Verify OPENAI_API_KEY is set, check backend logs |
| Data not loading | Ensure wh_Dataset/ folder exists with CSV files |
| Knowledge base error | Check CSV files are in correct format, restart backend |
| Port conflicts | Use different ports: UVICORN_PORT=8120, VITE_PORT=3001 |

---

## Performance Tips

- Keep both terminal windows visible to monitor logs
- Monitor backend startup time (should be < 5s)
- Monitor first chat response time (should be < 5s)
- Check browser DevTools Network tab for API latency
- Monitor memory usage of both processes

---

**Status: Ready to Deploy** ✅

Everything is set up and ready. Follow the steps above to start developing!
